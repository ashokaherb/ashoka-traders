const express = require("express");
const router = express.Router();
const { getCart, replaceCart, mergeCart } = require("../controllers/cartController");
const { protect } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

// All cart routes require a logged-in customer - guests keep their cart in
// localStorage instead (see the storefront's CartContext), and it gets merged
// up into the account by POST /merge at login.
router.get("/", protect, asyncHandler(getCart));
router.put("/", protect, asyncHandler(replaceCart));
router.post("/merge", protect, asyncHandler(mergeCart));

module.exports = router;
