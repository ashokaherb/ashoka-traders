const mongoose = require("mongoose");

/**
 * Shared shipping-address shape, embedded (not a separate collection) in both:
 *  - User.address    (the customer's saved address, for reuse at checkout)
 *  - Order.address    (a snapshot of the address used for that specific order)
 * Defined once here so both models stay in sync.
 */
const addressSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    addressLine: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true, default: "" },
  },
  { _id: false } // it's a sub-object, not its own document
);

module.exports = addressSchema;
