const crypto = require("crypto");
const Order = require("../models/Order");
const razorpayInstance = require("../utils/razorpay");
const { resolveOrderPricing, decrementStock, getSettings } = require("../utils/orderHelpers");
const { sendOrderConfirmationEmail, sendAdminNewOrderAlert } = require("../utils/sendEmail");
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
  try {
    const { items, address, couponCode, paymentMethod } = req.body;

    if (paymentMethod !== "COD") {
      return res.status(400).json({ message: "Use /api/orders/razorpay for online payment" });
    }
    if (!address) {
      return res.status(400).json({ message: "Shipping address is required" });
    }

    const pricing = await resolveOrderPricing({ items, couponCode });

    const order = await Order.create({
      user: req.user._id,
      items: pricing.resolvedItems,
      address,
      subtotal: pricing.subtotal,
      shippingFee: pricing.shippingFee,
      discount: pricing.discount,
      couponCode: pricing.appliedCouponCode,
      total: pricing.total,
      paymentMethod: "COD",
      paymentStatus: "pending",
      orderStatus: "Placed",
    });

    await decrementStock(pricing.resolvedItems);
    notifyByEmail(req.user, order);
    notifyByWhatsApp(req.user, order);

    res.status(201).json(order);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Could not create order" });
  }
};

/**
 * @route   POST /api/orders/razorpay
 * @desc    Create a Razorpay order for the current cart (does NOT touch stock or
 *          create our own Order yet - that only happens once payment is verified).
 * @access  Private
 */
const createRazorpayOrder = async (req, res) => {
  try {
    if (!razorpayInstance) {
      return res.status(500).json({ message: "Razorpay is not configured on the server yet" });
    }

    const { items, couponCode } = req.body;
    const pricing = await resolveOrderPricing({ items, couponCode });

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(pricing.total * 100), // Razorpay expects paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID, // safe to expose - only the secret must stay server-side
      pricing, // lets the frontend show an accurate summary while the payment popup is open
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Could not create Razorpay order" });
  }
};

/**
 * @route   POST /api/orders/razorpay/verify
 * @desc    Verify the payment signature Razorpay's checkout handler returns, and only
 *          THEN create the Order, deduct stock, and send notification emails.
 * @access  Private
 */
const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
      items,
      address,
      couponCode,
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: "Missing Razorpay payment details" });
    }
    if (!address) {
      return res.status(400).json({ message: "Shipping address is required" });
    }

    // Recompute the expected signature ourselves - never trust the client's word that payment succeeded.
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Stock may have moved since the checkout popup opened - re-validate now.
    const pricing = await resolveOrderPricing({ items, couponCode });

    const order = await Order.create({
      user: req.user._id,
      items: pricing.resolvedItems,
      address,
      subtotal: pricing.subtotal,
      shippingFee: pricing.shippingFee,
      discount: pricing.discount,
      couponCode: pricing.appliedCouponCode,
      total: pricing.total,
      paymentMethod: "Razorpay",
      paymentStatus: "paid",
      orderStatus: "Placed",
      razorpayOrderId,
      razorpayPaymentId,
    });

    await decrementStock(pricing.resolvedItems);
    notifyByEmail(req.user, order);
    notifyByWhatsApp(req.user, order);

    res.status(201).json(order);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Could not verify payment" });
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
 * @desc    Download a PDF invoice (GST "Tax Invoice" if Settings.gstNumber is set,
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
