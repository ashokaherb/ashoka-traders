const express = require("express");
const router = express.Router();
const upload = require("../middleware/cloudinaryUpload");
const { uploadImages } = require("../controllers/uploadController");
const { protect, admin } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

// Admin-only: used by the admin product form's image picker.
// (uploadImages is synchronous, but wrapped for consistency with every other route.)
router.post("/", protect, admin, upload.array("images", 6), asyncHandler(uploadImages));

module.exports = router;
