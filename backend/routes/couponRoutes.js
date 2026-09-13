const express = require("express");
const router = express.Router();
const {
  validateCoupon,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require("../controllers/couponController");
const { protect, admin } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

router.post("/validate", protect, asyncHandler(validateCoupon));

// Admin-only management
router.get("/", protect, admin, asyncHandler(getCoupons));
router.post("/", protect, admin, asyncHandler(createCoupon));
router.put("/:id", protect, admin, asyncHandler(updateCoupon));
router.delete("/:id", protect, admin, asyncHandler(deleteCoupon));

module.exports = router;
