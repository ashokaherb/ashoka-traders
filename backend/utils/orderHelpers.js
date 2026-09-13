const mongoose = require("mongoose");
const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const Settings = require("../models/Settings");
const { getActiveOffers, pickBestOffer, applyDiscount } = require("./offerPricing");
const { couponProblem, couponDiscount } = require("./couponRules");

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

  // Ids must be real ObjectId strings - an object like { $ne: ... } would match some other
  // product. Checked for every line before touching the database.
  for (const cartItem of items) {
    if (!cartItem || typeof cartItem.productId !== "string" || !mongoose.isValidObjectId(cartItem.productId)) {
      throw new OrderValidationError("Invalid product in cart");
    }
    if (cartItem.variantId && (typeof cartItem.variantId !== "string" || !mongoose.isValidObjectId(cartItem.variantId))) {
      throw new OrderValidationError("Invalid product option in cart");
    }
  }

  // Everything pricing needs, fetched in parallel - and ALL cart products in ONE query
  // (audit M5) instead of one findById per line. Variants live inside the product
  // document, so this single fetch includes their prices and stock too.
  // Offers are fetched once and reused for every line - this is also what makes an active
  // sale banner's discount actually apply at checkout, not just on the product page.
  const productIds = [...new Set(items.map((i) => i.productId))];
  const [offers, products, settings, coupon] = await Promise.all([
    getActiveOffers(),
    Product.find({ _id: { $in: productIds } }),
    getSettings(),
    couponCode ? Coupon.findOne({ code: String(couponCode).trim().toUpperCase() }) : null,
  ]);
  const productsById = new Map(products.map((p) => [p._id.toString(), p]));

  const resolvedItems = [];
  let subtotal = 0;

  for (const cartItem of items) {
    const product = productsById.get(cartItem.productId);
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
      hsnCode: product.hsnCode || "",
    });
  }

  // --- Coupon ---
  let discount = 0;
  let appliedCouponCode = null;
  if (couponCode) {
    const problem = couponProblem(coupon, subtotal);
    if (problem) throw new OrderValidationError(problem);
    discount = couponDiscount(coupon, subtotal);
    appliedCouponCode = coupon.code;
  }

  // --- Shipping ---
  // Free above the threshold (checked against subtotal, before discount), else a flat fee.
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
 * Thrown when stock runs out at the moment of the actual decrement - even if
 * resolveOrderPricing's earlier check said it was available. Carries the item
 * that failed so callers can tell the customer exactly what sold out.
 */
class OutOfStockError extends OrderValidationError {
  constructor(item) {
    super(`${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ""} just sold out`, 409);
    this.item = item;
  }
}

/**
 * Deducts stock for every line of an order, atomically. (Audit finding C3.)
 *
 * WHY: resolveOrderPricing's "quantity > stock" check and a later plain $inc are two
 * separate steps - five simultaneous checkouts for the last unit all pass the check
 * before any of them decrements, and stock goes negative (overselling).
 *
 * HOW: each line is ONE conditional update - "decrement, but only if stock >= quantity".
 * MongoDB evaluates the condition and applies the $inc as a single operation, so two
 * requests can never both take the last unit. If nothing matched (modifiedCount 0),
 * that line has sold out.
 *
 * MUST be called with a transaction session (see runInTransaction). If line 2 fails,
 * throwing aborts the transaction and line 1's decrement is rolled back too - a cart
 * is never half-deducted.
 *
 * @throws {OutOfStockError} on the first line that doesn't have enough stock
 */
async function decrementStock(resolvedItems, session) {
  if (!session) {
    throw new Error("decrementStock must run inside a transaction (pass a session)");
  }

  for (const item of resolvedItems) {
    let result;
    if (item.variantId) {
      // $elemMatch makes BOTH conditions apply to the same variant - without it, Mongo
      // could match "some variant has this id" and "some OTHER variant has enough stock".
      // The positional "$" then updates exactly the variant $elemMatch found.
      result = await Product.updateOne(
        {
          _id: item.product,
          variants: { $elemMatch: { _id: item.variantId, stock: { $gte: item.quantity } } },
        },
        { $inc: { "variants.$.stock": -item.quantity } },
        { session }
      );
    } else {
      result = await Product.updateOne(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { session }
      );
    }

    if (result.modifiedCount === 0) {
      throw new OutOfStockError(item);
    }
  }
}

/**
 * Runs `work(session)` inside a MongoDB transaction: everything it writes commits
 * together, or - if it throws - none of it does. withTransaction also retries
 * automatically on transient conflicts (two checkouts touching the same product),
 * which is safe because every write inside re-checks stock atomically.
 *
 * Requires a replica set - MongoDB Atlas always is one. (A plain local mongod is not;
 * run it as a single-node replica set for local development.)
 */
async function runInTransaction(work) {
  const session = await Product.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  OrderValidationError,
  OutOfStockError,
  resolveOrderPricing,
  decrementStock,
  runInTransaction,
  getSettings,
};
