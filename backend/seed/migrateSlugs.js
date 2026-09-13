/**
 * One-off migration: regenerates every product's slug using the new clean
 * "basmati-rice" style (Product.js's pre-save hook) instead of the old Phase 1
 * "basmati-rice-mtxe7cqw" timestamp-suffixed style. Only needs to run once after
 * upgrading to Phase 4 - existing products otherwise keep their old slug forever,
 * since the hook only regenerates it when the name changes.
 *
 * Run with: npm run migrate:slugs
 */
require("dotenv").config();
const connectDB = require("../config/db");
const Product = require("../models/Product");

const run = async () => {
  await connectDB();

  const products = await Product.find();
  for (const product of products) {
    product.markModified("name"); // forces the slug pre-save hook to regenerate it
    await product.save();
  }

  console.log(`Regenerated slugs for ${products.length} product(s).`);
  process.exit(0);
};

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
