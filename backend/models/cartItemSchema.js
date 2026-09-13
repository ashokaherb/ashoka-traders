const mongoose = require("mongoose");

/**
 * One line in a saved cart. The field names deliberately match the shape the
 * storefront's CartContext already uses, so the same object round-trips between
 * localStorage (guests) and the database (logged-in customers) with no mapping.
 *
 * It's denormalized on purpose (name/price/image are snapshots) so the cart page
 * renders without extra lookups. A stale price here can never affect what someone
 * is actually charged - order totals are always recomputed server-side at checkout
 * (see utils/orderHelpers.js).
 */
const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: { type: String, default: "" },
    variantLabel: { type: String, default: null },
    price: { type: Number, default: 0 },
    image: { type: String, default: "" },
    stock: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

module.exports = cartItemSchema;
