const express = require("express");
const router = express.Router();
const { getSettingsHandler, updateSettingsHandler } = require("../controllers/settingsController");
const { protect, admin } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

router.get("/", asyncHandler(getSettingsHandler)); // public - storefront needs this to preview shipping
router.put("/", protect, admin, asyncHandler(updateSettingsHandler));

module.exports = router;
