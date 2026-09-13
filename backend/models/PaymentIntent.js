const mongoose = require("mongoose");

/**
 * The server's record of what ONE Razorpay order is supposed to cost.
 *
 * Created in POST /api/orders/razorpay, BEFORE the customer pays, from the server's own
 * pricing (resolveOrderPricing). At verify time we look it up by razorpayOrderId and
 * build the real Order from THIS record - never from the items/prices in the verify
 * request body, which the client controls. (Audit finding C2.)
 *
 * Lifecycle (status):
 *   created    -> waiting for payment
 *   processing -> a verify request has claimed it (stops two parallel verifies both succeeding)
 *   consumed   -> turned into a real Order; can never be used again
 *   flagged    -> Razorpay's confirmed amount didn't match; kept for investigation
 *   needs_refund -> paid, but an item sold out before stock could be deducted (audit C3);
 *                   a Cancelled + refund_requested Order was created for the admin to refund
 *
 * Old intents clean themselves up via the TTL index on expiresAt (see below).
 */
const INTENT_TTL_HOURS = 24;

const intentItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    variantLabel: { type: String, default: null },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }, // server-calculated unit price
    hsnCode: { type: String, default: "" },
  },
  { _id: false }
);

const paymentIntentSchema = new mongoose.Schema(
  {
    razorpayOrderId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Snapshot of the server-side pricing at the moment the Razorpay order was created
    items: { type: [intentItemSchema], required: true },
    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    couponCode: { type: String, default: null },
    total: { type: Number, required: true },
    amountPaise: { type: Number, required: true }, // exactly what Razorpay was told to charge

    status: {
      type: String,
      enum: ["created", "processing", "consumed", "flagged", "needs_refund"],
      default: "created",
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null }, // set once consumed
    razorpayPaymentId: { type: String, default: null },

    // MongoDB deletes the document automatically once this date passes. Set to null on
    // flagged intents so the evidence of a tampering attempt isn't auto-deleted.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + INTENT_TTL_HOURS * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

// TTL index: expireAfterSeconds 0 means "delete when expiresAt is reached"
paymentIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PaymentIntent", paymentIntentSchema);
