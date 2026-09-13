const mongoose = require("mongoose");

/**
 * A storewide or category-specific sale banner. The storefront shows all
 * currently-active offers as a scrolling banner on the homepage, and the
 * discount is applied automatically to matching products' prices (both for
 * display and at actual checkout - see utils/offerPricing.js).
 */
const offerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Offer title is required"],
      trim: true, // e.g. "Flat 20% off on all Spices!"
    },
    discountPercent: {
      type: Number,
      required: true,
      min: 1,
      max: 90,
    },
    // "all" applies the discount storewide, or a Category _id (as a string) restricts
    // it to just that category.
    appliesTo: {
      type: String,
      required: true,
      default: "all",
    },
    active: {
      type: Boolean,
      default: true,
    },
    // Both optional - leave blank for an offer that runs indefinitely while active=true.
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Offer", offerSchema);
