const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  getMe,
  refreshToken,
  updateAddress,
  updateWhatsAppPreference,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

router.post("/register", asyncHandler(registerUser));
router.post("/login", asyncHandler(loginUser));
router.get("/me", protect, asyncHandler(getMe));
router.post("/refresh", protect, asyncHandler(refreshToken));
router.put("/address", protect, asyncHandler(updateAddress));
router.put("/whatsapp", protect, asyncHandler(updateWhatsAppPreference));

module.exports = router;
