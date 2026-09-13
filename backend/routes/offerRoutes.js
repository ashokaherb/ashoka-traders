const express = require("express");
const router = express.Router();
const {
  getActiveOffersHandler,
  getAllOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  broadcastOffer,
} = require("../controllers/offerController");
const { protect, admin } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

// "/active" is registered first purely as a convention matching the rest of the app -
// there's no "/:id" GET route here to conflict with anyway.
router.get("/active", asyncHandler(getActiveOffersHandler)); // public - storefront banner
router.get("/", protect, admin, asyncHandler(getAllOffers));
router.post("/", protect, admin, asyncHandler(createOffer));
router.put("/:id", protect, admin, asyncHandler(updateOffer));
router.delete("/:id", protect, admin, asyncHandler(deleteOffer));
router.post("/:id/broadcast", protect, admin, asyncHandler(broadcastOffer));

module.exports = router;
