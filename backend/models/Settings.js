const mongoose = require("mongoose");

/**
 * Store-wide settings. This is a "singleton" collection - only one document
 * ever exists (see getSettings() in utils/orderHelpers.js, which creates it
 * with defaults on first read). Editable via the admin Settings page.
 */
const settingsSchema = new mongoose.Schema(
  {
    freeShippingThreshold: {
      type: Number,
      default: 1000, // order subtotal (in Rs) at/above which shipping is free
    },
    flatShippingFee: {
      type: Number,
      default: 49, // flat fee (in Rs) charged below the threshold
    },
    minimumOrderValue: {
      type: Number,
      default: 0, // 0 = no minimum enforced
    },
    storeName: {
      type: String,
      default: "Ashoka Traders",
    },
    // Optional - if set, orders get a GST "Tax Invoice"; if blank, a plain receipt instead.
    gstNumber: {
      type: String,
      default: "",
    },
    supportEmail: {
      type: String,
      default: "",
    },
    supportPhone: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
