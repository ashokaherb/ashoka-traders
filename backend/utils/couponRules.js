const Coupon = require("../models/Coupon");

// Whether a coupon can be used, and what it's worth. Shared by /coupons/validate, the
// checkout "Available Coupons" list and resolveOrderPricing, so all three always agree.

const isExpired = (coupon, now = new Date()) => Boolean(coupon.expiryDate && coupon.expiryDate < now);
const isUsedUp = (coupon) => coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit;

/**
 * @returns {string|null} why the coupon can't be used on this subtotal, or null if it can
 */
function couponProblem(coupon, subtotal) {
  if (!coupon || !coupon.active) return "Invalid or inactive coupon code";
  if (isExpired(coupon)) return "This coupon has expired";
  if (isUsedUp(coupon)) return "This coupon has reached its usage limit";
  if (coupon.minOrderValue > 0 && subtotal < coupon.minOrderValue) {
    return `This coupon requires a minimum order of ₹${coupon.minOrderValue}`;
  }
  return null;
}

// Discount in rupees - never more than the subtotal, so the total can't go negative.
function couponDiscount(coupon, subtotal) {
  const raw = coupon.discountType === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  return Math.round(Math.min(raw, subtotal) * 100) / 100;
}

/**
 * Counts one use of a coupon, inside the order's transaction so an order that rolls back
 * never burns a use. The limit check and the increment happen in a single atomic update,
 * so two customers racing for the last use can't both get it.
 *
 * @param {string} code
 * @param {import("mongoose").ClientSession} session
 * @param {{ enforceLimit?: boolean }} [options] - false for already-paid orders: the customer
 *   has been charged the discounted price, so the order must go through even if the last
 *   use was taken while they were paying.
 * @returns {Promise<boolean>} false if enforceLimit is on and no uses were left
 */
async function claimCouponUse(code, session, { enforceLimit = true } = {}) {
  if (!code) return true;

  const underLimit = {
    $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
  };
  const result = await Coupon.updateOne(
    { code, ...(enforceLimit ? underLimit : {}) },
    { $inc: { usedCount: 1 } },
    { session }
  );
  return enforceLimit ? result.modifiedCount === 1 : true;
}

module.exports = { couponProblem, couponDiscount, claimCouponUse, isExpired, isUsedUp };
