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
const {
  sendOrderConfirmationEmail,
  sendAdminNewOrderAlert,
  sendAdminRefundRequiredAlert,
} = require("../utils/sendEmail");
const { sendWhatsAppMessage } = require("../utils/whatsappService");
const { generateInvoicePDF } = require("../utils/generateInvoicePDF");

// Fire-and-forget email helper - a slow/broken mail server should never block an order.
const notifyByEmail = (user, order) => {
  sendOrderConfirmationEmail(user, order).catch((err) => console.error("Email error:", err.message));
  sendAdminNewOrderAlert(order).catch((err) => console.error("Email error:", err.message));
};

// Transactional WhatsApp messages - order confirmation to the customer and a new-order
// alert to the admin. These are sent regardless of the customer's promotional opt-in
// (whatsappOptIn) - only whether we HAVE a number for them matters, since a number is
// only ever collected through the opt-in flow in the first place (see Register.jsx /
// Profile.jsx). Promotional broadcasts (offers, new arrivals) are the ones that check
// whatsappOptIn - see offerController.js / productController.js.
const notifyByWhatsApp = (user, order) => {
  const orderNumber = order._id.toString().slice(-8).toUpperCase();
  const itemsSummary = order.items
    .map((i) => `${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} x${i.quantity}`)
    .join(", ");

  if (user.whatsappNumber) {
    sendWhatsAppMessage(
      user.whatsappNumber,
      `Hi ${user.name}, your Ashoka Traders order #${orderNumber} is confirmed!\nItems: ${itemsSummary}\nTotal: Rs.${order.total}\nPayment: ${order.paymentMethod} (${order.paymentStatus})`
    ).catch((err) => console.error("WhatsApp send error:", err.message));
  }

  if (process.env.ADMIN_WHATSAPP_NUMBER) {
    sendWhatsAppMessage(
      process.env.ADMIN_WHATSAPP_NUMBER,
      `New order #${orderNumber} from ${user.name} - Rs.${order.total} (${order.paymentMethod})`
    ).catch((err) => console.error("WhatsApp send error:", err.message));
  }
};

/**
 * @route   POST /api/orders
 * @desc    Place a Cash on Delivery order (paid orders go through the /razorpay routes instead)
 * @access  Private
 */
const createOrder = async (req, res) => {
  const { items, address, couponCode, paymentMethod } = req.body;

  if (paymentMethod !== "COD") {
    return res.status(400).json({ message: "Use /api/orders/razorpay for online payment" });
  }
  if (!address) {
    return res.status(400).json({ message: "Shipping address is required" });
  }

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

  const { items, couponCode } = req.body;
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

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ message: "Missing Razorpay payment details" });
  }
  if (!address) {
    return res.status(400).json({ message: "Shipping address is required" });
  }
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

    // Built from the STORED intent only - not from anything in req.body except the address.
    const orderFields = {
      user: req.user._id,
      items: claimed.items,
      address,
      subtotal: claimed.subtotal,
      shippingFee: claimed.shippingFee,
      discount: claimed.discount,
      couponCode: claimed.couponCode,
      total: claimed.total,
      paymentMethod: "Razorpay",
      razorpayOrderId,
      razorpayPaymentId,
    };

    let order;
    try {
      // Stock deduction, order creation and burning the intent all commit together
      // (audit C3) - or none of them do.
      order = await runInTransaction(async (session) => {
        await decrementStock(claimed.items, session);
        // Already paid at the discounted price, so the order goes through even if the
        // coupon's last use was taken while this customer was paying.
        if (claimed.couponCode) {
          const withinLimit = await claimCouponUse(claimed.couponCode, session);
          if (!withinLimit) {
            await claimCouponUse(claimed.couponCode, session, { enforceLimit: false });
            console.warn(`[COUPON LIMIT EXCEEDED] ${claimed.couponCode} used past its limit by paid order (${razorpayOrderId})`);
          }
        }
        const [created] = await Order.create(
          [
            {
              ...orderFields,
              billNumber: await nextBillNumber(new Date(), session),
              paymentStatus: "paid",
              orderStatus: "Placed",
            },
          ],
          { session }
        );
        await PaymentIntent.updateOne(
          { _id: claimed._id },
          { $set: { status: "consumed", order: created._id, razorpayPaymentId } },
          { session }
        );
        return created;
      });
    } catch (error) {
      if (!(error instanceof OutOfStockError)) throw error; // handled by the outer catch

      // The customer HAS paid, but an item sold out between checkout and payment. The
      // transaction rolled back, so no stock was touched. Don't just return an error and
      // lose track of their money - record a cancelled order with a refund request so it
      // shows up in the admin's order list AND the customer's "My Orders".
      // (Refunds themselves are issued in the Razorpay dashboard.)
      const refundOrder = await Order.create({
        ...orderFields,
        paymentStatus: "refund_requested",
        orderStatus: "Cancelled",
      });
      await PaymentIntent.updateOne(
        { _id: claimed._id },
        // No TTL - keep this record until the refund is dealt with
        { $set: { status: "needs_refund", order: refundOrder._id, razorpayPaymentId, expiresAt: null } }
      );
      console.error(
        `[REFUND NEEDED] Paid order could not be fulfilled - ${error.message}.`,
        JSON.stringify({ orderId: refundOrder._id, razorpayPaymentId, amount: claimed.total, userId: req.user._id })
      );
      // Fire-and-forget, like the other notifications - a mail failure must not change
      // the response. The order record + log line above are the fallback if it fails.
      sendAdminRefundRequiredAlert(refundOrder, { user: req.user, reason: error.message }).catch((err) =>
        console.error("Email error (refund alert):", err.message)
      );

      return res.status(409).json({
        message: `Sorry - ${error.message} while your payment was processing, so we couldn't place this order. Your payment of Rs.${claimed.total} will be refunded in full to your original payment method.`,
        orderId: refundOrder._id,
        refundPending: true,
      });
    }

    notifyByEmail(req.user, order);
    notifyByWhatsApp(req.user, order);

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
 * @route   GET /api/orders/my
 * @access  Private
 */
const getMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(orders);
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
 * @route   GET /api/orders
 * @access  Private/Admin
 */
const getAllOrders = async (req, res) => {
  const orders = await Order.find().populate("user", "name email").sort({ createdAt: -1 });
  res.json(orders);
};

/**
 * @route   GET /api/orders/export
 * @desc    Download all orders (optionally filtered by ?startDate=&endDate=, YYYY-MM-DD)
 *          as a CSV file.
 * @access  Private/Admin
 */
const exportOrdersCSV = async (req, res) => {
  const { startDate, endDate } = req.query;
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

  // A value containing a comma, quote, or newline needs wrapping in quotes (with quotes doubled).
  const escapeCsv = (value) => {
    const str = String(value ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

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

  const { orderStatus, trackingNumber, paymentStatus } = req.body;
  if (orderStatus !== undefined) order.orderStatus = orderStatus;
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
