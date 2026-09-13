const express = require("express");
const router = express.Router();
const { submitContactQuery } = require("../controllers/contactController");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const schemas = require("../validation/schemas");

router.post("/", validate(schemas.contact), asyncHandler(submitContactQuery));

module.exports = router;
