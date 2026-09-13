const mongoose = require("mongoose");
const User = require("../models/User");
const Product = require("../models/Product");
const { decorateWithOffers } = require("../utils/productPricing");

/**
 * @route   GET /api/wishlist
 * @desc    The logged-in customer's saved products (with offer pricing applied,
 *          same as everywhere else products are shown)
 * @access  Private
 */
const getWishlist = async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: "wishlist",
    populate: { path: "category", select: "name slug" },
  });

  res.json(await decorateWithOffers(user.wishlist));
};

/**
 * @route   POST /api/wishlist/:productId
 * @access  Private
 */
const addToWishlist = async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const alreadySaved = req.user.wishlist.some((id) => id.toString() === req.params.productId);
  if (!alreadySaved) {
    req.user.wishlist.push(product._id);
    await req.user.save();
  }

  res.json({ message: "Added to wishlist" });
};

/**
 * @route   DELETE /api/wishlist/:productId
 * @access  Private
 */
const removeFromWishlist = async (req, res) => {
  req.user.wishlist = req.user.wishlist.filter((id) => id.toString() !== req.params.productId);
  await req.user.save();

  res.json({ message: "Removed from wishlist" });
};

/**
 * @route   POST /api/wishlist/merge
 * @desc    Merge a guest wishlist (product ids from localStorage) into the account's
 *          saved wishlist - called once, right after login/registration. Ids that
 *          aren't valid or no longer exist are simply dropped, since this payload
 *          comes from untrusted browser storage.
 * @access  Private
 */
const mergeWishlist = async (req, res) => {
  const incoming = Array.isArray(req.body.productIds) ? req.body.productIds : [];
  const validIds = incoming.filter((id) => mongoose.isValidObjectId(id));

  if (validIds.length > 0) {
    const existingProducts = await Product.find({ _id: { $in: validIds } }).select("_id");
    const alreadySaved = new Set(req.user.wishlist.map((id) => id.toString()));

    for (const product of existingProducts) {
      if (!alreadySaved.has(product._id.toString())) {
        req.user.wishlist.push(product._id);
      }
    }
    await req.user.save();
  }

  // Respond with the full wishlist, same shape as GET /api/wishlist.
  const user = await User.findById(req.user._id).populate({
    path: "wishlist",
    populate: { path: "category", select: "name slug" },
  });
  res.json(await decorateWithOffers(user.wishlist));
};

module.exports = { getWishlist, addToWishlist, removeFromWishlist, mergeWishlist };
