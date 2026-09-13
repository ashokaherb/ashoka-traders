const express = require("express");
const router = express.Router();
const { submitContactQuery } = require("../controllers/contactController");
const asyncHandler = require("../middleware/asyncHandler");

router.post("/", asyncHandler(submitContactQuery));

module.exports = router;
