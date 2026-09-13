const express = require("express");
const router = express.Router();
const {
  validateCoupon,
  getAvailableCoupons,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require("../controllers/couponController");
const { protect, admin } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const schemas = require("../validation/schemas");

router.post("/validate", protect, asyncHandler(validateCoupon));
// Checkout's "Available Coupons" list - declared before "/:id" routes so it isn't read as an id.
router.get("/available", protect, asyncHandler(getAvailableCoupons));

// Admin-only management
router.get("/", protect, admin, asyncHandler(getCoupons));
router.post("/", protect, admin, validate(schemas.couponCreate), asyncHandler(createCoupon));
router.put("/:id", protect, admin, validate(schemas.couponUpdate), asyncHandler(updateCoupon));
router.delete("/:id", protect, admin, asyncHandler(deleteCoupon));

module.exports = router;
