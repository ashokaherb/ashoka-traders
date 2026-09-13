const mongoose = require("mongoose");
const addressSchema = require("./addressSchema");

/**
 * One line item in an order. We snapshot "name", "variantLabel" and "price" at
 * the time of purchase so the order record stays accurate even if the product
 * is later renamed, its price changes, or it's deleted entirely.
 */
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    variantLabel: { type: String, default: null }, // e.g. "500g", null if no variant
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }, // unit price AT THE TIME OF ORDER
    hsnCode: { type: String, default: "" }, // printed on the bill
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: (items) => items.length > 0,
    },
    address: {
      type: addressSchema,
      required: true,
    },
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: null },
    total: { type: Number, required: true, min: 0 },

    paymentMethod: {
      type: String,
      enum: ["COD", "Razorpay"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refund_requested", "refunded"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: ["Placed", "Packed", "Shipped", "Delivered", "Cancelled"],
      default: "Placed",
    },
    trackingNumber: { type: String, default: "" },
    // Consecutive per financial year, e.g. "AT/26-27/0001" - see utils/billNumber.js.
    // Null for orders that never became a sale (paid but sold out -> refunded).
    billNumber: { type: String, default: null },

    // Only populated for Razorpay orders, used to cross-reference with the Razorpay dashboard
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
  },
  { timestamps: true }
);

// Replay protection (audit C2): one Razorpay payment can only ever become ONE order.
// "partial" so it only applies to real payment ids - every COD order has null here,
// and a plain unique index would treat all those nulls as duplicates of each other.
orderSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: "string" } } }
);

// A bill number can never be issued twice (null for orders without one, hence partial).
orderSchema.index(
  { billNumber: 1 },
  { unique: true, partialFilterExpression: { billNumber: { $type: "string" } } }
);

module.exports = mongoose.model("Order", orderSchema);
