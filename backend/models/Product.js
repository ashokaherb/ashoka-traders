const mongoose = require("mongoose");

/**
 * A product variant, e.g. "500g" vs "1kg" of the same item.
 * If a product has no variants, the base price/stock on the product itself is used.
 * If it does have variants, each variant carries its own price + stock.
 */
const variantSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true, // e.g. "500g", "1kg", "Red", "Large"
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: [true, "Base price is required"],
      min: 0,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    variants: {
      type: [variantSchema],
      default: [], // empty array = no variants, just use base price/stock
    },
    images: {
      type: [String], // image URLs. Phase 1: paste a URL. Later: real file upload.
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true, // lets admin "soft delete" / hide a product without removing it
    },
    // Admin dashboard's "Low Stock" widget flags this product when stock (or any
    // variant's stock) falls at or below this number.
    // HSN code (goods classification under GST) - printed on the bill/invoice. Optional.
    hsnCode: {
      type: String,
      default: "",
      trim: true,
      match: [/^(\d{4}|\d{6}|\d{8})?$/, "HSN code must be 4, 6 or 8 digits"],
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
    // Customers who clicked "Notify Me" while this product was out of stock.
    // Emailed once it comes back in stock, then cleared (see utils/notifyStock.js).
    notifyRequests: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    // Star rating shown on product cards. Both default to 0 and the storefront only
    // renders the stars once reviewCount > 0 - so a product with no real ratings yet
    // simply shows no stars, rather than an invented score. Set these from the admin
    // product form as you collect genuine feedback (there's no review system yet).
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // True by default when a product is created (shows a "New" badge on the storefront
    // for its first 7 days - see the isRecentArrival check wherever it's displayed).
    // Admin can also flip it manually - e.g. turn it off early, or back on to re-flag an
    // older product as new again for a fresh WhatsApp broadcast.
    isNewArrival: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Auto-generate a clean, URL-friendly slug from the name (e.g. "Basmati Rice" ->
// "basmati-rice"), used for SEO-friendly product URLs like /product/basmati-rice
// instead of a raw Mongo id. Only touches the slug when the name actually changes,
// and appends "-2", "-3", etc. ONLY if that exact slug is already taken by another
// product - most products never need the suffix at all.
productSchema.pre("save", async function (next) {
  if (this.isModified("name")) {
    const base = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    let slug = base;
    let suffix = 1;
    // eslint-disable-next-line no-await-in-loop -- collisions are rare, a loop keeps this simple
    while (await this.constructor.exists({ slug, _id: { $ne: this._id } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    this.slug = slug;
  }
  next();
});

// Basic text index so search (?search=) can match name/description
productSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("Product", productSchema);
