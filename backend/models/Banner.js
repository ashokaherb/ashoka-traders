const mongoose = require("mongoose");

/**
 * A homepage banner-carousel slide (see storefront/src/components/BannerCarousel.jsx).
 * "order" controls display sequence - the admin reorders slides with up/down arrows,
 * which re-saves every slide's order via PUT /api/banners/reorder.
 */
const bannerSchema = new mongoose.Schema(
  {
    image: {
      type: String,
      required: [true, "Banner image is required"],
      trim: true,
    },
    // Optional text overlaid on the slide - left blank for an image-only banner.
    title: {
      type: String,
      trim: true,
      default: "",
    },
    // Optional destination when the slide is clicked/tapped - a relative path (e.g.
    // "/category/spices") or a full URL. Left blank makes the slide non-clickable.
    linkUrl: {
      type: String,
      trim: true,
      default: "",
    },
    order: {
      type: Number,
      default: 0,
    },
    // Lets the admin temporarily hide a slide without losing its image/title/link -
    // only active banners are ever sent to the storefront (see getActiveBanners).
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);
