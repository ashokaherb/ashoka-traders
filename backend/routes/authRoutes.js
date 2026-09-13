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
const validate = require("../middleware/validate");
const schemas = require("../validation/schemas");

router.post("/register", validate(schemas.register), asyncHandler(registerUser));
router.post("/login", validate(schemas.login), asyncHandler(loginUser));
router.get("/me", protect, asyncHandler(getMe));
router.post("/refresh", protect, asyncHandler(refreshToken));
router.put("/address", protect, validate(schemas.address), asyncHandler(updateAddress));
router.put("/whatsapp", protect, validate(schemas.whatsappPreference), asyncHandler(updateWhatsAppPreference));

module.exports = router;
