const mongoose = require("mongoose");
const { GST_SCHEMES } = require("../utils/invoiceType");

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
    // GSTIN. Blank = plain receipt, whatever gstScheme says.
    gstNumber: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    // Decides the order document (see utils/invoiceType.js):
    //  composition    -> "Bill of Supply", no tax shown (dealer can't collect GST)
    //  regular        -> "Tax Invoice" with CGST/SGST or IGST breakdown
    //  not_registered -> plain receipt
    // Defaults to not_registered so an unset scheme never produces a document showing tax.
    gstScheme: {
      type: String,
      enum: GST_SCHEMES,
      default: "not_registered",
    },
    // Regular scheme only: tax rate (%) included in product prices, and the store's state
    // (same state as the customer -> CGST + SGST, otherwise IGST). Ignored for composition.
    gstRate: {
      type: Number,
      default: 5,
      min: 0,
      max: 40,
    },
    storeState: {
      type: String,
      default: "Uttarakhand",
      trim: true,
    },
    // Printed in the bill/invoice header.
    storeAddress: {
      type: String,
      default: "3 Dhamawala Bazaar, Dehradun, Uttarakhand",
      trim: true,
    },
    panNumber: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    // Short terms printed at the bottom of every bill - one per line, keep it to 2-3 lines.
    invoiceTerms: {
      type: String,
      default: [
        "Items can be returned or exchanged only if damaged or incorrect - report within 48 hours of delivery.",
        "Please keep the original packing and this bill for any return or exchange.",
        "To cancel, contact us before the order is shipped.",
      ].join("\n"),
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
