const User = require("../models/User");
const { sendBackInStockEmail } = require("./sendEmail");

/** True if every purchasable option on this product is out of stock. */
function isFullyOutOfStock(product) {
  if (product.variants && product.variants.length > 0) {
    return product.variants.every((v) => v.stock <= 0);
  }
  return product.stock <= 0;
}

/**
 * Call this AFTER saving a product's updated stock, passing whether it was
 * fully out of stock BEFORE the update (take that snapshot before applying
 * changes). If it just came back into stock and had pending notify-me
 * requests, emails everyone on the list and clears it.
 *
 * Shared by both the single-product edit form and the bulk CSV upload, so
 * "notify me" fires the same way regardless of how the stock was updated.
 */
async function notifyIfBackInStock(product, wasOutOfStock) {
  if (!wasOutOfStock) return;
  if (isFullyOutOfStock(product)) return; // still out of stock - nothing to notify
  if (!product.notifyRequests || product.notifyRequests.length === 0) return;

  const users = await User.find({ _id: { $in: product.notifyRequests } });
  for (const user of users) {
    sendBackInStockEmail(user, product).catch((err) => console.error("Email error:", err.message));
  }

  product.notifyRequests = [];
  await product.save();
}

module.exports = { isFullyOutOfStock, notifyIfBackInStock };
