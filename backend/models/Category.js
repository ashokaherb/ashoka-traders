const mongoose = require("mongoose");

/**
 * Product categories (e.g. "Grocery", "Stationery").
 * "slug" is a URL-friendly version of the name, e.g. "Rice & Grains" -> "rice-grains",
 * used for clean category filter links on the storefront.
 */
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
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
    // Optional image shown on the storefront's "Shop by Category" cards. Paste a
    // hosted URL, or use the product image uploader's URL. When blank, the card
    // falls back to a brand-coloured tile with the category's initial.
    image: {
      type: String,
      trim: true,
      default: "",
    },
    // Admin picks which categories appear as direct links in the storefront's main
    // nav bar (a horizontal strip that only has room for a handful) - everything else
    // is still reachable via "Shop by Category" and the shop's category filter, just
    // not pinned in the nav. Capped at 4 in the admin UI, and the storefront's NavBar
    // also slices to 4 as a backstop in case the flag is ever set on more than that.
    showInNav: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Auto-generate the slug from the name whenever the name changes
categorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

module.exports = mongoose.model("Category", categorySchema);
