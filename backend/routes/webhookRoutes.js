const express = require("express");
const router = express.Router();
const { handleRazorpayWebhook } = require("../controllers/webhookController");
const asyncHandler = require("../middleware/asyncHandler");

// NOTE: express.raw() (not express.json()) - the Razorpay signature is computed over the
// EXACT bytes sent, so the body must not be parsed and re-serialised first. server.js
// mounts this router before express.json() for the same reason.
router.post("/razorpay", express.raw({ type: "*/*", limit: "1mb" }), asyncHandler(handleRazorpayWebhook));

module.exports = router;
