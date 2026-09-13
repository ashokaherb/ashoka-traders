const express = require("express");
const router = express.Router();
const { getSitemap } = require("../controllers/sitemapController");
const asyncHandler = require("../middleware/asyncHandler");

router.get("/", asyncHandler(getSitemap));

module.exports = router;
