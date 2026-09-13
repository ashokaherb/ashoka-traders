const express = require("express");
const router = express.Router();
const {
  getActiveBanners,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  reorderBanners,
} = require("../controllers/bannerController");
const { protect, admin } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

// Public - storefront homepage carousel
router.get("/active", asyncHandler(getActiveBanners)); // literal path - must come before "/:id"

// Admin-only
router.get("/", protect, admin, asyncHandler(getAllBanners));
router.post("/", protect, admin, asyncHandler(createBanner));
router.put("/reorder", protect, admin, asyncHandler(reorderBanners)); // literal path - must come before "/:id"
router.put("/:id", protect, admin, asyncHandler(updateBanner));
router.delete("/:id", protect, admin, asyncHandler(deleteBanner));

module.exports = router;
