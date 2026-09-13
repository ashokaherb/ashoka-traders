const Coupon = require("../models/Coupon");

/**
 * @route   POST /api/coupons/validate
 * @desc    Check a coupon code against the current cart subtotal and return the discount.
 * @access  Private (checkout requires login, so this does too)
 */
const validateCoupon = async (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ message: "Coupon code is required" });

  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon || !coupon.active) {
    return res.status(400).json({ message: "Invalid or inactive coupon code" });
  }
  if (coupon.expiryDate && coupon.expiryDate < new Date()) {
    return res.status(400).json({ message: "This coupon has expired" });
  }

  let discount =
    coupon.discountType === "percent" ? (Number(subtotal) * coupon.value) / 100 : coupon.value;
  discount = Math.min(discount, Number(subtotal) || 0);

  res.json({
    code: coupon.code,
    discountType: coupon.discountType,
    value: coupon.value,
    discount,
  });
};

// --- Admin CRUD ---
// No admin UI page for these yet (that's part of Phase 3's offers/banner management),
// but the routes exist now so coupons can be created/tested without touching MongoDB directly.

const getCoupons = async (req, res) => {
  res.json(await Coupon.find().sort({ createdAt: -1 }));
};

const createCoupon = async (req, res) => {
  try {
    const { code, discountType, value, active, expiryDate } = req.body;
    const coupon = await Coupon.create({ code, discountType, value, active, expiryDate });
    res.status(201).json(coupon);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "A coupon with this code already exists" });
    }
    res.status(500).json({ message: "Could not create coupon", error: error.message });
  }
};

const updateCoupon = async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return res.status(404).json({ message: "Coupon not found" });

  Object.assign(coupon, req.body);
  const updated = await coupon.save();
  res.json(updated);
};

const deleteCoupon = async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return res.status(404).json({ message: "Coupon not found" });

  await coupon.deleteOne();
  res.json({ message: "Coupon deleted" });
};

module.exports = { validateCoupon, getCoupons, createCoupon, updateCoupon, deleteCoupon };
