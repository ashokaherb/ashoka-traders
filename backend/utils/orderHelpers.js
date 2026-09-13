const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const Settings = require("../models/Settings");
const { getActiveOffers, pickBestOffer, applyDiscount } = require("./offerPricing");

/**
 * A validation failure that the order controllers can catch and turn into a
 * proper HTTP response (e.g. 400 for "insufficient stock" instead of a 500).
 */
class OrderValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Settings is a singleton collection - create it with defaults on first read.
const getSettings = async () => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  return settings;
};

/**
 * Re-validates a cart against the database and computes the full price breakdown.
 * This is the ONLY place order totals are calculated - both the COD and Razorpay
 * flows call it, and it never trusts prices/stock numbers sent by the client.
 *
 * @param {Array<{productId, variantId, quantity}>} items - raw cart lines from the client
 * @param {string} [couponCode]
 * @returns {{resolvedItems, subtotal, discount, appliedCouponCode, shippingFee, total}}
 */
async function resolveOrderPricing({ items, couponCode }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderValidationError("Cart is empty");
  }

  const resolvedItems = [];
  let subtotal = 0;

  // Fetched once and reused for every line - this is also what makes an active sale
  // banner's discount actually apply at checkout, not just on the product page.
  const offers = await getActiveOffers();

  for (const cartItem of items) {
    const product = await Product.findById(cartItem.productId);
    if (!product || !product.isActive) {
      throw new OrderValidationError(`Product not found or unavailable: ${cartItem.productId}`);
    }

    let unitPrice;
    let availableStock;
    let variantId = null;
    let variantLabel = null;

    if (cartItem.variantId) {
      const variant = product.variants.id(cartItem.variantId);
      if (!variant) {
        throw new OrderValidationError(`Selected option no longer exists for ${product.name}`);
      }
      unitPrice = variant.price;
      availableStock = variant.stock;
      variantId = variant._id;
      variantLabel = variant.label;
    } else {
      unitPrice = product.price;
      availableStock = product.stock;
    }

    const offer = pickBestOffer(offers, product.category);
    unitPrice = applyDiscount(unitPrice, offer);

    const quantity = Number(cartItem.quantity) || 0;
    if (quantity <= 0) {
      throw new OrderValidationError(`Invalid quantity for ${product.name}`);
    }
    if (quantity > availableStock) {
      throw new OrderValidationError(
        `Insufficient stock for ${product.name}${variantLabel ? ` (${variantLabel})` : ""}. Only ${availableStock} left.`
      );
    }

    subtotal += unitPrice * quantity;
    resolvedItems.push({
      product: product._id,
      name: product.name,
      variantId,
      variantLabel,
      quantity,
      price: unitPrice,
    });
  }

  // --- Coupon ---
  let discount = 0;
  let appliedCouponCode = null;
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    if (!coupon || !coupon.active) {
      throw new OrderValidationError("Invalid or inactive coupon code");
    }
    if (coupon.expiryDate && coupon.expiryDate < new Date()) {
      throw new OrderValidationError("This coupon has expired");
    }
    discount =
      coupon.discountType === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
    discount = Math.min(discount, subtotal); // never let discount push the total negative
    appliedCouponCode = coupon.code;
  }

  // --- Shipping ---
  // Free above the threshold (checked against subtotal, before discount), else a flat fee.
  const settings = await getSettings();
  const shippingFee = subtotal >= settings.freeShippingThreshold ? 0 : settings.flatShippingFee;

  // --- Minimum order value ---
  // Checked against subtotal (matches the checkout page's own preview check) and only
  // enforced when the admin has actually set one - 0/unset means no minimum at all.
  // Re-checked here even though the storefront already blocks the button, so a minimum
  // can never be bypassed by calling the API directly.
  if (settings.minimumOrderValue > 0 && subtotal < settings.minimumOrderValue) {
    throw new OrderValidationError(
      `Minimum order value is Rs.${settings.minimumOrderValue}. Add Rs.${(settings.minimumOrderValue - subtotal).toFixed(2)} more to checkout.`
    );
  }

  const total = Math.max(subtotal - discount + shippingFee, 0);

  return { resolvedItems, subtotal, discount, appliedCouponCode, shippingFee, total };
}

/**
 * Actually deducts stock in the DB. Call this only once an order is confirmed
 * (COD placed, or Razorpay payment verified) - never before.
 */
async function decrementStock(resolvedItems) {
  for (const item of resolvedItems) {
    if (item.variantId) {
      await Product.updateOne(
        { _id: item.product, "variants._id": item.variantId },
        { $inc: { "variants.$.stock": -item.quantity } }
      );
    } else {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: -item.quantity } });
    }
  }
}

module.exports = { OrderValidationError, resolveOrderPricing, decrementStock, getSettings };
