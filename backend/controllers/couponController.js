const Coupon = require("../models/Coupon");
const { couponProblem, couponDiscount, isExpired, isUsedUp } = require("../utils/couponRules");

/**
 * @route   POST /api/coupons/validate
 * @desc    Check a coupon code against the current cart subtotal and return the discount.
 *          Doesn't count as a use - that only happens when an order is actually placed.
 * @access  Private (checkout requires login, so this does too)
 */
const validateCoupon = async (req, res) => {
  const { code } = req.body;
  const subtotal = Number(req.body.subtotal) || 0;
  if (!code) return res.status(400).json({ message: "Coupon code is required" });

  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() });
  const problem = couponProblem(coupon, subtotal);
  if (problem) return res.status(400).json({ message: problem });

  res.json({
    code: coupon.code,
    discountType: coupon.discountType,
    value: coupon.value,
    minOrderValue: coupon.minOrderValue,
    discount: couponDiscount(coupon, subtotal),
  });
};

/**
 * @route   GET /api/coupons/available?subtotal=
 * @desc    Coupons to show on the checkout page: active, not expired, not used up.
 *          Each says whether the cart qualifies yet, and how much more it needs if not.
 * @access  Private
 */
const getAvailableCoupons = async (req, res) => {
  const subtotal = Number(req.query.subtotal) || 0;
  const coupons = await Coupon.find({ active: true }).sort({ minOrderValue: 1, createdAt: -1 });

  const available = coupons
    .filter((c) => !isExpired(c) && !isUsedUp(c))
    .map((c) => {
      const shortBy = Math.max(c.minOrderValue - subtotal, 0);
      return {
        code: c.code,
        discountType: c.discountType,
        value: c.value,
        minOrderValue: c.minOrderValue,
        expiryDate: c.expiryDate || null,
        eligible: shortBy === 0,
        shortBy: Math.round(shortBy * 100) / 100,
        discount: shortBy === 0 ? couponDiscount(c, subtotal) : 0,
      };
    });

  res.json(available);
};

// --- Admin CRUD ---

// Only these fields come from the admin form. usedCount is deliberately missing - it's
// only changed by placing orders, so the "times used" figure can be trusted.
function pickCouponFields(body) {
  const fields = {};
  if (body.code !== undefined) fields.code = body.code;
  if (body.discountType !== undefined) fields.discountType = body.discountType;
  if (body.value !== undefined) fields.value = body.value;
  if (body.active !== undefined) fields.active = body.active;
  if (body.expiryDate !== undefined) fields.expiryDate = body.expiryDate || null;
  if (body.minOrderValue !== undefined) fields.minOrderValue = Number(body.minOrderValue) || 0;
  if (body.usageLimit !== undefined) {
    fields.usageLimit = body.usageLimit === "" || body.usageLimit === null ? null : Number(body.usageLimit);
  }
  return fields;
}

const duplicateCode = (res) => res.status(400).json({ message: "A coupon with this code already exists" });

const getCoupons = async (req, res) => {
  res.json(await Coupon.find().sort({ createdAt: -1 }));
};

const createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create(pickCouponFields(req.body));
    res.status(201).json(coupon);
  } catch (error) {
    if (error.code === 11000) return duplicateCode(res);
    throw error; // anything else -> central errorHandler (hides internals in production)
  }
};

const updateCoupon = async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return res.status(404).json({ message: "Coupon not found" });

  Object.assign(coupon, pickCouponFields(req.body));
  try {
    res.json(await coupon.save());
  } catch (error) {
    if (error.code === 11000) return duplicateCode(res);
    throw error;
  }
};

const deleteCoupon = async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return res.status(404).json({ message: "Coupon not found" });

  await coupon.deleteOne();
  res.json({ message: "Coupon deleted" });
};

module.exports = {
  validateCoupon,
  getAvailableCoupons,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};
