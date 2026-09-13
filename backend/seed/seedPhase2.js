/**
 * One-off script that seeds the data Phase 2 needs to be testable out of the box:
 *  - A default Settings document (shipping rule)
 *  - A sample coupon ("WELCOME10") so checkout's coupon field has something to test
 *
 * Run it with: npm run seed:phase2
 * Safe to run more than once - it skips anything that already exists.
 */
require("dotenv").config();
const connectDB = require("../config/db");
const Settings = require("../models/Settings");
const Coupon = require("../models/Coupon");

const run = async () => {
  await connectDB();

  let settings = await Settings.findOne();
  if (!settings) {
    // minimumOrderValue is left at its schema default (0 = disabled/not enforced) -
    // flatShippingFee stays admin-configurable from here via the Settings page.
    settings = await Settings.create({ freeShippingThreshold: 1000, flatShippingFee: 49 });
    console.log("Created default settings:", settings.toObject());
  } else {
    console.log("Settings already exist:", settings.toObject());
  }

  const existingCoupon = await Coupon.findOne({ code: "WELCOME10" });
  if (!existingCoupon) {
    const coupon = await Coupon.create({
      code: "WELCOME10",
      discountType: "percent",
      value: 10,
      active: true,
    });
    console.log(`Created sample coupon: ${coupon.code} (10% off)`);
  } else {
    console.log("Sample coupon WELCOME10 already exists");
  }

  process.exit(0);
};

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
