const mongoose = require("mongoose");

/**
 * A discount coupon applied at checkout.
 * discountType "percent" -> value is a percentage (e.g. 10 = 10% off)
 * discountType "flat"    -> value is a flat rupee amount off
 *
 * Admin UI for managing these comes in Phase 3 (offers/banners). For now they're
 * created via the seed script or directly through the admin-only API routes.
 */
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true, // always store/compare in uppercase so "welcome10" and "WELCOME10" match
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["percent", "flat"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
    expiryDate: {
      type: Date, // optional - no expiry if left unset
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);
