const crypto = require("crypto");
const Order = require("../models/Order");
const PaymentIntent = require("../models/PaymentIntent");
const razorpayInstance = require("../utils/razorpay");
const {
  resolveOrderPricing,
  decrementStock,
  runInTransaction,
  OutOfStockError,
  OrderValidationError,
  getSettings,
} = require("../utils/orderHelpers");
const { claimCouponUse } = require("../utils/couponRules");
const { nextBillNumber, ensureBillNumber } = require("../utils/billNumber");
const { parsePagination, paginatedResponse } = require("../utils/pagination");
const { ORDER_STATUS_TRANSITIONS, canMoveOrderStatus } = require("../utils/orderStatus");
const {
  sendOrderConfirmationEmail,
  sendAdminNewOrderAlert,
} = require("../utils/sendEmail");
const { generateInvoicePDF } = require("../utils/generateInvoicePDF");
const { notifyByEmail, notifyByWhatsApp } = require("../utils/orderNotifications");
const { fulfillPaidIntent } = require("../utils/fulfillPaidOrder");

/**
 * @route   POST /api/orders
 * @desc    Place a Cash on Delivery order (paid orders go through the /razorpay routes instead)
 * @access  Private
 */
const createOrder = async (req, res) => {
  // Validated by schemas.codOrder: cart lines, a complete address, paymentMethod "COD".
  const { items, address, couponCode } = req.body;

  const pricing = await resolveOrderPricing({ items, couponCode });

  // Stock deduction and order creation commit together (audit C3). If any item sold out
  // since the check above, decrementStock throws, the transaction aborts, every earlier
  // decrement is rolled back, and no order record is ever written.
  const order = await runInTransaction(async (session) => {
    await decrementStock(pricing.resolvedItems, session);
    // Count the coupon use as part of the same transaction - if the last use was taken a
    // moment ago, this aborts everything (stock included) and the customer is told why.
    if (!(await claimCouponUse(pricing.appliedCouponCode, session))) {
      throw new OrderValidationError("This coupon has reached its usage limit");
    }
    const [created] = await Order.create(
      [
        {
          user: req.user._id,
          items: pricing.resolvedItems,
          address,
          subtotal: pricing.subtotal,
          shippingFee: pricing.shippingFee,
          discount: pricing.discount,
          couponCode: pricing.appliedCouponCode,
          total: pricing.total,
          billNumber: await nextBillNumber(new Date(), session),
          paymentMethod: "COD",
          paymentStatus: "pending",
          orderStatus: "Placed",
        },
      ],
      { session } // array form is required by Mongoose when passing options
    );
    return created;
  });

  // Notifications only after the transaction has committed
  notifyByEmail(req.user, order);
  notifyByWhatsApp(req.user, order);

  res.status(201).json(order);
};

/**
 * @route   POST /api/orders/razorpay
 * @desc    Create a Razorpay order for the current cart (does NOT touch stock or
 *          create our own Order yet - that only happens once payment is verified).
 * @access  Private
 */
const createRazorpayOrder = async (req, res) => {
  if (!razorpayInstance) {
    return res.status(500).json({ message: "Razorpay is not configured on the server yet" });
  }

  const { items, couponCode, address } = req.body;
  const pricing = await resolveOrderPricing({ items, couponCode });

  const amountPaise = Math.round(pricing.total * 100); // Razorpay expects paise
  const razorpayOrder = await razorpayInstance.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
  });

  // Remember what THIS Razorpay order is supposed to cost. /verify builds the real Order
  // from this record, so nothing the client sends later can change the items or price.
  await PaymentIntent.create({
    razorpayOrderId: razorpayOrder.id,
    user: req.user._id,
    items: pricing.resolvedItems,
    subtotal: pricing.subtotal,
    shippingFee: pricing.shippingFee,
    discount: pricing.discount,
    couponCode: pricing.appliedCouponCode,
    total: pricing.total,
    amountPaise,
    address, // lets the webhook finish this order if the browser never confirms the payment
  });

  res.json({
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    key: process.env.RAZORPAY_KEY_ID, // safe to expose - only the secret must stay server-side
    pricing, // lets the frontend show an accurate summary while the payment popup is open
  });
};

// Security events get one consistent, greppable prefix so they're easy to find in the logs.
const logTamper = (reason, details) => {
  console.warn(`[PAYMENT TAMPER SUSPECTED] ${reason}`, JSON.stringify(details));
};

// "productId:variantId:quantity" per line, sorted - so two carts compare equal regardless of order.
const cartFingerprint = (lines) =>
  lines
    .map((l) => `${l.product || l.productId}:${l.variantId || ""}:${Number(l.quantity)}`)
    .sort()
    .join("|");

/**
 * @route   POST /api/orders/razorpay/verify
 * @desc    Confirm a Razorpay payment and turn it into a real Order. Checks, in order:
 *            1. HMAC signature           - Razorpay really issued this order_id + payment_id pair
 *            2. Stored PaymentIntent     - what this Razorpay order was priced at, server-side
 *            3. Razorpay's confirmed amount matches that stored price (fetched from Razorpay's API)
 *            4. This payment id hasn't already been used for an order (replay protection)
 *          The Order is built ONLY from the stored intent. Items/prices in the request body
 *          are never used - if a client sends ones that differ, the request is rejected.
 * @access  Private
 */
const verifyRazorpayPayment = async (req, res) => {
  const {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
    items,
    address,
  } = req.body;

  // Payment ids, cart and address are validated by schemas.razorpayVerify before this runs.
  if (!razorpayInstance) {
    return res.status(500).json({ message: "Razorpay is not configured on the server yet" });
  }

  // --- 1. Signature (unchanged) ---
  // Recompute the expected signature ourselves - never trust the client's word that payment succeeded.
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    return res.status(400).json({ message: "Payment verification failed" });
  }

  // --- 2. Look up what this Razorpay order was supposed to cost ---
  const intent = await PaymentIntent.findOne({ razorpayOrderId });
  if (!intent) {
    return res.status(400).json({ message: "Unknown or expired payment session. Please contact support." });
  }
  if (intent.status === "consumed") {
    return res.status(409).json({ message: "This payment has already been processed", orderId: intent.order });
  }
  if (intent.status === "flagged") {
    // Already failed the amount check once - stays blocked until someone looks at it
    return res.status(400).json({ message: "Payment could not be verified. Please contact support." });
  }
  if (intent.user.toString() !== req.user._id.toString()) {
    logTamper("verify submitted by a different user than created the payment", {
      razorpayOrderId, intentUser: intent.user, requestUser: req.user._id,
    });
    return res.status(403).json({ message: "This payment does not belong to your account" });
  }

  // The client has no reason to send a different cart than the one it just paid for.
  // We'd never USE it anyway, but a mismatch means someone is probing - refuse and log it.
  if (items !== undefined && (!Array.isArray(items) || cartFingerprint(items) !== cartFingerprint(intent.items))) {
    logTamper("verify request items differ from the paid-for cart", {
      razorpayOrderId, userId: req.user._id, paidFor: cartFingerprint(intent.items),
      submitted: Array.isArray(items) ? cartFingerprint(items) : typeof items,
    });
    return res.status(400).json({ message: "Order details do not match the payment" });
  }

  // --- Claim the intent atomically ---
  // Only one request can flip "created" -> "processing". A second identical request
  // fired at the same moment finds nothing to claim, so it can't create a second order.
  const claimed = await PaymentIntent.findOneAndUpdate(
    { _id: intent._id, status: "created" },
    { $set: { status: "processing" } },
    { new: true }
  );
  if (!claimed) {
    return res.status(409).json({ message: "This payment has already been processed" });
  }

  // If anything below fails for an ordinary reason (network, DB), release the claim
  // so the customer - who HAS paid - can retry instead of being stuck.
  const releaseClaim = () =>
    PaymentIntent.updateOne({ _id: claimed._id, status: "processing" }, { $set: { status: "created" } });

  try {
    // --- 3. Ask Razorpay what was ACTUALLY paid ---
    const payment = await razorpayInstance.payments.fetch(razorpayPaymentId);

    const problems = [];
    if (payment.order_id !== razorpayOrderId) problems.push("payment belongs to a different order");
    if (payment.amount !== claimed.amountPaise) problems.push("amount mismatch");
    if (payment.currency !== "INR") problems.push("currency mismatch");
    // "authorized" = money held, auto-captured shortly after (Razorpay's default setting)
    if (!["captured", "authorized"].includes(payment.status)) problems.push(`payment status is "${payment.status}"`);

    if (problems.length > 0) {
      // Suspicious - do NOT silently correct. Freeze the intent (no TTL, never reusable)
      // so it's still there when someone investigates.
      await PaymentIntent.updateOne(
        { _id: claimed._id },
        { $set: { status: "flagged", razorpayPaymentId, expiresAt: null } }
      );
      logTamper(problems.join("; "), {
        razorpayOrderId, razorpayPaymentId, userId: req.user._id,
        expectedPaise: claimed.amountPaise, razorpayPaise: payment.amount,
        razorpayStatus: payment.status, razorpayOrderIdOnPayment: payment.order_id,
      });
      return res.status(400).json({ message: "Payment could not be verified. Please contact support." });
    }

    // --- 4. Replay protection ---
    // Belt and braces with the unique index on Order.razorpayPaymentId (caught below).
    const existing = await Order.findOne({ razorpayPaymentId }).select("_id");
    if (existing) {
      await releaseClaim();
      return res.status(409).json({ message: "This payment has already been processed", orderId: existing._id });
    }

    // Create the order from the stored intent. Shared with the Razorpay webhook so both
    // paths behave identically (utils/fulfillPaidOrder.js) - including the sold-out refund
    // path and the order confirmation emails.
    const { outcome, order } = await fulfillPaidIntent({
      intent: claimed,
      user: req.user,
      address,
      razorpayPaymentId,
      source: "verify",
    });

    if (outcome === "refund_pending") {
      return res.status(409).json({
        message: `Sorry - an item sold out while your payment was processing, so we couldn't place this order. Your payment of Rs.${claimed.total} will be refunded in full to your original payment method.`,
        orderId: order._id,
        refundPending: true,
      });
    }

    return res.status(201).json(order);
  } catch (error) {
    if (error.code === 11000) {
      // Unique index caught a replay that slipped past the findOne above
      return res.status(409).json({ message: "This payment has already been processed" });
    }
    await releaseClaim();
    throw error; // asyncHandler -> central error handler
  }
};

/**
 * @route   GET /api/orders/my?page=&limit=
 * @desc    The customer's orders, newest first, paginated (default 20 per page).
 *          Returns { data, page, limit, totalPages, totalCount }.
 * @access  Private
 */
const getMyOrders = async (req, res) => {
  const pagination = parsePagination(req.query);
  const filter = { user: req.user._id };
  const [orders, totalCount] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    Order.countDocuments(filter),
  ]);
  res.json(paginatedResponse(orders, pagination, totalCount));
};

/**
 * @route   GET /api/orders/:id
 * @desc    Get one order - only its owner or the admin may view it
 * @access  Private
 */
const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email");
  if (!order) return res.status(404).json({ message: "Order not found" });

  const isOwner = order.user._id.toString() === req.user._id.toString();
  if (!isOwner && !req.user.isAdmin) {
    return res.status(403).json({ message: "Not authorized to view this order" });
  }

  res.json(order);
};

/**
 * @route   GET /api/orders/:id/invoice
 * @desc    Download a PDF invoice (Bill of Supply / Tax Invoice / receipt per Settings.gstScheme,
 *          otherwise a plain receipt) - owner or admin only.
 * @access  Private
 */
const downloadInvoice = async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email");
  if (!order) return res.status(404).json({ message: "Order not found" });

  const isOwner = order.user._id.toString() === req.user._id.toString();
  if (!isOwner && !req.user.isAdmin) {
    return res.status(403).json({ message: "Not authorized to view this order" });
  }

  const settings = await getSettings();
  await ensureBillNumber(order);
  generateInvoicePDF(order, settings, res);
};

/**
 * @route   GET /api/orders?page=&limit=
 * @desc    All orders, newest first, paginated (default 20 per page).
 *          Returns { data, page, limit, totalPages, totalCount }.
 * @access  Private/Admin
 */
const getAllOrders = async (req, res) => {
  const pagination = parsePagination(req.query);
  const [orders, totalCount] = await Promise.all([
    Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 }) // matches the createdAt index (audit M2)
      .skip(pagination.skip)
      .limit(pagination.limit),
    Order.countDocuments(),
  ]);
  res.json(paginatedResponse(orders, pagination, totalCount));
};

/**
 * One CSV cell. Text cells starting with = + - @ (or tab / carriage return) are prefixed
 * with a single quote, so Excel/Sheets show them as text instead of running them as a
 * formula (audit M14) - a customer named =HYPERLINK("http://evil.com","click") would
 * otherwise put a live link in the admin's spreadsheet. Wrapping in quotes alone doesn't
 * stop this. Numbers (totals) are left alone. Then commas, quotes and newlines are
 * escaped as usual.
 */
const escapeCsv = (value) => {
  if (typeof value === "number") return String(value);
  let str = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

/**
 * @route   GET /api/orders/export
 * @desc    Download all orders (optionally filtered by ?startDate=&endDate=, YYYY-MM-DD)
 *          as a CSV file.
 * @access  Private/Admin
 */
const exportOrdersCSV = async (req, res) => {
  const { startDate, endDate } = req.query;
  // YYYY-MM-DD strings only - anything else (arrays, objects, junk) is rejected (audit M1).
  const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());
  if ((startDate !== undefined && !isDay(startDate)) || (endDate !== undefined && !isDay(endDate))) {
    return res.status(400).json({ message: "startDate and endDate must be dates in YYYY-MM-DD format" });
  }
  const filter = {};
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // include the whole end day
      filter.createdAt.$lte = end;
    }
  }

  const orders = await Order.find(filter).populate("user", "name email").sort({ createdAt: -1 });

  const header = ["Order ID", "Customer", "Items", "Total", "Payment Method", "Payment Status", "Order Status", "Date"];
  const rows = orders.map((order) => {
    const itemsSummary = order.items
      .map((item) => `${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ""} x${item.quantity}`)
      .join("; ");

    return [
      order._id.toString(),
      order.user?.name || "Guest",
      itemsSummary,
      order.total,
      order.paymentMethod,
      order.paymentStatus,
      order.orderStatus,
      order.createdAt.toISOString(),
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="orders-${Date.now()}.csv"`);
  res.send(csv);
};

/**
 * @route   PUT /api/orders/:id/status
 * @desc    Update order status, tracking number, and/or payment status. paymentStatus is
 *          set manually here since actual refunds are processed in the Razorpay dashboard -
 *          this just lets the admin reflect that status back to the customer's "My Orders".
 * @access  Private/Admin
 */
const updateOrderStatus = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  // Values are validated by schemas.orderStatusUpdate; the MOVE between statuses is checked here.
  const { orderStatus, trackingNumber, paymentStatus } = req.body;
  if (orderStatus !== undefined && orderStatus !== order.orderStatus) {
    if (!canMoveOrderStatus(order.orderStatus, orderStatus)) {
      const allowed = ORDER_STATUS_TRANSITIONS[order.orderStatus] || [];
      return res.status(400).json({
        message:
          `Cannot move from ${order.orderStatus} to ${orderStatus}.` +
          (allowed.length ? ` Allowed next: ${allowed.join(" or ")}.` : ` ${order.orderStatus} is final.`),
        code: "INVALID_STATUS_TRANSITION",
      });
    }
    order.orderStatus = orderStatus;
  }
  if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
  if (paymentStatus !== undefined) order.paymentStatus = paymentStatus;

  const updated = await order.save();
  res.json(updated);
};

module.exports = {
  createOrder,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getMyOrders,
  getOrderById,
  getAllOrders,
  exportOrdersCSV,
  updateOrderStatus,
  downloadInvoice,
};
