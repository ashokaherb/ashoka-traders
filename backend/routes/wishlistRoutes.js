const express = require("express");
const router = express.Router();
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  mergeWishlist,
} = require("../controllers/wishlistController");
const { protect } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

// All wishlist routes require a logged-in customer - guests keep their wishlist in
// localStorage instead, and it gets merged up into the account by POST /merge at login.
// NOTE: "/merge" must be registered before "/:productId", otherwise Express would
// match it as if "merge" were a product id.
router.get("/", protect, asyncHandler(getWishlist));
router.post("/merge", protect, asyncHandler(mergeWishlist));
router.post("/:productId", protect, asyncHandler(addToWishlist));
router.delete("/:productId", protect, asyncHandler(removeFromWishlist));

module.exports = router;
