const mongoose = require("mongoose");

/**
 * Named, atomically-incremented counters. Used for consecutive bill numbers - one counter
 * per financial year ("bill-2026-27"), so numbering restarts at 1 every April as GST rules
 * expect. See utils/billNumber.js.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String }, // counter name
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model("Counter", counterSchema);
