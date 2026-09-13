const mongoose = require("mongoose");

/**
 * A discount coupon applied at checkout. Managed from the admin Coupons page.
 * discountType "percent" -> value is a percentage (e.g. 10 = 10% off)
 * discountType "flat"    -> value is a flat rupee amount off
 *
 * The rules for whether a coupon can be used live in utils/couponRules.js.
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
      validate: {
        validator(v) {
          return this.discountType !== "percent" || v <= 100;
        },
        message: "A percentage discount can't be more than 100%",
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
    expiryDate: {
      type: Date, // optional - no expiry if left unset
    },
    // Cart subtotal (Rs) needed to use the coupon. 0 = no minimum.
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Total uses allowed across all customers. null = unlimited.
    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },
    // Orders actually placed with this coupon. Only ever changed by the order flow
    // (see claimCouponUse), never by the admin form.
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);
