const crypto = require("crypto");
const PaymentIntent = require("../models/PaymentIntent");
const Order = require("../models/Order");
const User = require("../models/User");
const { fulfillPaidIntent } = require("../utils/fulfillPaidOrder");
const { sendAdminManualOrderAlert } = require("../utils/sendEmail");

// How long a "processing" intent may sit before the webhook assumes the browser flow died
// mid-way and takes it over. Long enough that a slow but live verify request finishes first.
const STALE_PROCESSING_MS = 5 * 60 * 1000;

const log = (message, details) => console.log(`[RAZORPAY WEBHOOK] ${message}`, details ? JSON.stringify(details) : "");

/** Constant-time compare so a wrong signature can't be guessed byte by byte from timings. */
function signatureMatches(rawBody, header, secret) {
  if (!header) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = Buffer.from(String(header), "utf8");
  const mine = Buffer.from(expected, "utf8");
  return given.length === mine.length && crypto.timingSafeEqual(given, mine);
}

/**
 * @route   POST /api/webhooks/razorpay
 * @desc    Reconciles payments Razorpay has captured. The browser normally calls
 *          /api/orders/razorpay/verify right after paying, but if the customer closes the
 *          tab, loses signal, or the request fails, that never happens - the money is taken
 *          and no order exists. Razorpay calls this endpoint server-to-server instead, so
 *          the order still gets created.
 *
 *          Deliberately returns 200 for anything it cannot act on (unknown payment, already
 *          handled, mismatch) so Razorpay stops retrying; 4xx/5xx are reserved for problems
 *          where a retry could genuinely succeed. Everything unusual is logged.
 *
 *          Needs the RAW request body for the signature, so it is mounted with
 *          express.raw() BEFORE express.json() in server.js.
 * @access  Public (authenticated by the Razorpay webhook signature, not by a login)
 */
const handleRazorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[RAZORPAY WEBHOOK] RAZORPAY_WEBHOOK_SECRET is not set - webhook rejected.");
    return res.status(503).json({ message: "Webhook not configured" });
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  if (!signatureMatches(rawBody, req.headers["x-razorpay-signature"], secret)) {
    console.warn(`[RAZORPAY WEBHOOK] Invalid signature - request refused (ip ${req.ip})`);
    return res.status(400).json({ message: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ message: "Invalid JSON" });
  }

  const payment = event?.payload?.payment?.entity;
  if (event?.event !== "payment.captured" || !payment) {
    // Any other event (payment.failed, refund.*, order.paid...) needs no action here.
    log(`ignored event "${event?.event}"`);
    return res.status(200).json({ received: true, handled: false });
  }

  const { id: razorpayPaymentId, order_id: razorpayOrderId, amount, currency } = payment;

  // --- Idempotency: has this payment already become an order? ---
  const existingOrder = await Order.findOne({ razorpayPaymentId }).select("_id");
  if (existingOrder) {
    log("payment already has an order - nothing to do", { razorpayPaymentId, orderId: existingOrder._id });
    return res.status(200).json({ received: true, handled: false, reason: "already processed" });
  }

  const intent = await PaymentIntent.findOne({ razorpayOrderId });
  if (!intent) {
    // Nothing to reconcile against: the intent expired (24h TTL) or the payment was made
    // against an order this server didn't create. Needs a human, not a retry.
    console.error("[RAZORPAY WEBHOOK] No payment session found for a captured payment - manual check needed", JSON.stringify({ razorpayPaymentId, razorpayOrderId, amount }));
    return res.status(200).json({ received: true, handled: false, reason: "no matching payment session" });
  }
  if (["consumed", "needs_refund", "flagged", "needs_manual"].includes(intent.status)) {
    log(`payment session already in "${intent.status}" - nothing to do`, { razorpayPaymentId });
    return res.status(200).json({ received: true, handled: false, reason: intent.status });
  }

  // --- The amount must match what WE priced, not what the request says ---
  if (amount !== intent.amountPaise || currency !== "INR") {
    await PaymentIntent.updateOne(
      { _id: intent._id },
      { $set: { status: "flagged", razorpayPaymentId, expiresAt: null } }
    );
    console.warn(
      "[PAYMENT TAMPER SUSPECTED] webhook amount/currency does not match the stored payment session",
      JSON.stringify({ razorpayPaymentId, razorpayOrderId, expectedPaise: intent.amountPaise, webhookPaise: amount, currency })
    );
    return res.status(200).json({ received: true, handled: false, reason: "amount mismatch" });
  }

  // --- Claim it, so the browser callback and this webhook can't both create an order ---
  // "created" is the normal case. A "processing" intent is only taken over once it has sat
  // untouched for STALE_PROCESSING_MS, which means the browser flow died part-way through.
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
  const claimed = await PaymentIntent.findOneAndUpdate(
    {
      _id: intent._id,
      $or: [{ status: "created" }, { status: "processing", updatedAt: { $lt: staleBefore } }],
    },
    { $set: { status: "processing" } },
    { new: true }
  );
  if (!claimed) {
    // The browser callback is handling it right now - let it finish. Razorpay retries,
    // and by then the order will exist and the idempotency check above returns early.
    log("payment session is being processed by the browser callback - leaving it alone", { razorpayPaymentId });
    return res.status(200).json({ received: true, handled: false, reason: "in progress" });
  }

  const user = await User.findById(claimed.user);
  if (!user) {
    await PaymentIntent.updateOne({ _id: claimed._id }, { $set: { status: "needs_manual", razorpayPaymentId, expiresAt: null } });
    console.error("[RAZORPAY WEBHOOK] Paid session has no user account - manual check needed", JSON.stringify({ razorpayPaymentId }));
    return res.status(200).json({ received: true, handled: false, reason: "user missing" });
  }

  // The address is saved on the intent when the Razorpay order is created. Older sessions
  // (created before that change) have none, and a shipping address can't be invented - so
  // flag it for the admin instead of guessing.
  if (!claimed.address || !claimed.address.pincode) {
    await PaymentIntent.updateOne(
      { _id: claimed._id },
      { $set: { status: "needs_manual", razorpayPaymentId, expiresAt: null } }
    );
    console.error(
      "[RAZORPAY WEBHOOK] Paid session has no shipping address - order must be completed by hand",
      JSON.stringify({ razorpayPaymentId, razorpayOrderId, userId: String(user._id), amount: claimed.total })
    );
    sendAdminManualOrderAlert({ intent: claimed, user, razorpayPaymentId }).catch((err) =>
      console.error("Email error (manual order alert):", err.message)
    );
    return res.status(200).json({ received: true, handled: false, reason: "no address on payment session" });
  }

  const { outcome, order } = await fulfillPaidIntent({
    intent: claimed,
    user,
    address: claimed.address,
    razorpayPaymentId,
    source: "webhook",
  });

  log(`recovered a payment the browser never confirmed -> ${outcome}`, {
    razorpayPaymentId,
    orderId: String(order._id),
    billNumber: order.billNumber || null,
  });
  return res.status(200).json({ received: true, handled: true, outcome, orderId: order._id });
};

module.exports = { handleRazorpayWebhook };
