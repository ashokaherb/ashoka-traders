const mongoose = require("mongoose");

/**
 * Keeps only the fields the cart schema expects, and drops anything malformed -
 * cart payloads can originate from a guest's localStorage, so they're untrusted.
 */
const sanitizeItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => item && mongoose.isValidObjectId(item.productId))
    .map((item) => ({
      productId: item.productId,
      variantId: mongoose.isValidObjectId(item.variantId) ? item.variantId : null,
      name: String(item.name || ""),
      variantLabel: item.variantLabel ? String(item.variantLabel) : null,
      price: Number(item.price) || 0,
      image: String(item.image || ""),
      stock: Number(item.stock) || 0,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    }));
};

const sameLine = (a, b) =>
  a.productId.toString() === b.productId.toString() &&
  String(a.variantId || "") === String(b.variantId || "");

/**
 * @route   GET /api/cart
 * @desc    The logged-in customer's saved cart
 * @access  Private
 */
const getCart = async (req, res) => {
  res.json(req.user.cart || []);
};

/**
 * @route   PUT /api/cart
 * @desc    Replace the saved cart with the given items. The storefront's CartContext
 *          holds the whole cart in state, so every change just saves the new array -
 *          one endpoint instead of separate add/remove/quantity routes.
 * @access  Private
 */
const replaceCart = async (req, res) => {
  req.user.cart = sanitizeItems(req.body.items);
  await req.user.save();
  res.json(req.user.cart);
};

/**
 * @route   POST /api/cart/merge
 * @desc    Merge a guest cart (from localStorage) into the account's saved cart -
 *          called once, right after login/registration.
 *
 *          Where the same product+variant exists in both, the HIGHER quantity wins
 *          rather than the two being added together: that way a merge running twice
 *          (e.g. a double-mounted effect, or a retried request) can never silently
 *          inflate someone's cart.
 * @access  Private
 */
const mergeCart = async (req, res) => {
  const incoming = sanitizeItems(req.body.items);
  const merged = [...(req.user.cart || []).map((item) => item.toObject())];

  for (const item of incoming) {
    const existing = merged.find((m) => sameLine(m, item));
    if (existing) {
      existing.quantity = Math.max(existing.quantity, item.quantity);
    } else {
      merged.push(item);
    }
  }

  req.user.cart = merged;
  await req.user.save();
  res.json(req.user.cart);
};

module.exports = { getCart, replaceCart, mergeCart };
