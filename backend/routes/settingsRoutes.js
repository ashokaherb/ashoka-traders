const express = require("express");
const router = express.Router();
const { getSettingsHandler, updateSettingsHandler } = require("../controllers/settingsController");
const { protect, admin } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const schemas = require("../validation/schemas");

router.get("/", asyncHandler(getSettingsHandler)); // public - storefront needs this to preview shipping
router.put("/", protect, admin, validate(schemas.settingsUpdate), asyncHandler(updateSettingsHandler));

module.exports = router;
