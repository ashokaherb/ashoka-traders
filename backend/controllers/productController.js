const { Readable } = require("stream");
const mongoose = require("mongoose");
const csvParser = require("csv-parser");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const { decorateWithOffers } = require("../utils/productPricing");
const { isFullyOutOfStock, notifyIfBackInStock } = require("../utils/notifyStock");
const { sendWhatsAppBroadcast } = require("../utils/whatsappService");
const { parsePagination, paginatedResponse, MAX_LIMIT } = require("../utils/pagination");

/**
 * @route   GET /api/products
 * @desc    List products. Supports optional query params:
 *            ?category=<categoryId>   filter by category
 *            ?search=<text>           search name/description
 *            ?ids=<id,id,id>          fetch specific products (used to resolve a
 *                                     guest's localStorage wishlist into products)
 *            ?page=&limit=            pagination (default 20 per page, max 100)
 *          Returns { data, page, limit, totalPages, totalCount }.
 * @access  Public
 */
const getProducts = async (req, res) => {
  const filter = { isActive: true };
  const { category, search } = req.query;

  // Query values can arrive as arrays (?category=a&category=b) or objects (?category[x]=y),
  // not just strings - only accept exactly the type each filter expects (audit M1).
  if (category !== undefined && category !== "") {
    if (typeof category !== "string" || !mongoose.isValidObjectId(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }
    filter.category = category;
  }
  if (search !== undefined && search !== "") {
    if (typeof search !== "string" || search.length > 100) {
      return res.status(400).json({ message: "Invalid search" });
    }
    filter.$text = { $search: search };
  }
  let defaultLimit;
  if (req.query.ids) {
    const ids = String(req.query.ids)
      .split(",")
      .map((id) => id.trim())
      .filter((id) => mongoose.isValidObjectId(id));
    filter._id = { $in: ids };
    defaultLimit = Math.min(Math.max(ids.length, 1), MAX_LIMIT); // a wishlist comes back in one page
  }

  const pagination = parsePagination(req.query, { defaultLimit });
  // Only the requested page is populated and offer-priced, not the whole catalogue.
  const [products, totalCount] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .sort({ createdAt: -1, _id: -1 }) // _id tie-breaker keeps pages stable
      .skip(pagination.skip)
      .limit(pagination.limit),
    Product.countDocuments(filter),
  ]);

  res.json(paginatedResponse(await decorateWithOffers(products), pagination, totalCount));
};

/**
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id).populate("category", "name slug");
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(await decorateWithOffers(product));
};

/**
 * @route   GET /api/products/best-sellers
 * @desc    Products ranked by how many units have actually sold, for the homepage's
 *          "Best Selling Products" row. Optional ?limit= (default 6).
 *
 *          On a brand-new store with no orders yet there's nothing to rank, so this
 *          falls back to the newest products - that way the section is never empty,
 *          and it becomes genuinely sales-ranked as soon as orders start coming in.
 * @access  Public
 */
const getBestSellers = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 24);

  const ranked = await Order.aggregate([
    { $unwind: "$items" },
    { $group: { _id: "$items.product", totalQuantity: { $sum: "$items.quantity" } } },
    { $sort: { totalQuantity: -1 } },
    { $limit: limit },
  ]);

  const rankedIds = ranked.map((r) => r._id).filter(Boolean);
  let products = [];

  if (rankedIds.length > 0) {
    const found = await Product.find({ _id: { $in: rankedIds }, isActive: true }).populate(
      "category",
      "name slug"
    );
    // Mongo returns these in arbitrary order - restore the sales ranking.
    const order = new Map(rankedIds.map((id, index) => [id.toString(), index]));
    products = found.sort((a, b) => order.get(a._id.toString()) - order.get(b._id.toString()));
  }

  // Top up (or fill entirely) with the newest products if sales data doesn't cover the limit.
  if (products.length < limit) {
    const alreadyIncluded = products.map((p) => p._id);
    const filler = await Product.find({ isActive: true, _id: { $nin: alreadyIncluded } })
      .sort({ createdAt: -1 })
      .limit(limit - products.length)
      .populate("category", "name slug");
    products = [...products, ...filler];
  }

  res.json(await decorateWithOffers(products));
};

/**
 * @route   GET /api/products/slug/:slug
 * @desc    Same as GET /:id, but looked up by the SEO-friendly slug - this is what
 *          the storefront's product page actually uses in its URL.
 * @access  Public
 */
const getProductBySlug = async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug }).populate("category", "name slug");
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(await decorateWithOffers(product));
};

/**
 * @route   GET /api/products/:id/related
 * @desc    Up to 6 other active products from the same category, for the
 *          "You may also like" row on the product detail page.
 * @access  Public
 */
const getRelatedProducts = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const related = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
    isActive: true,
  })
    .limit(6)
    .populate("category", "name slug");

  res.json(await decorateWithOffers(related));
};

/**
 * @route   POST /api/products
 * @access  Private/Admin
 */
const createProduct = async (req, res) => {
  const {
    name,
    description,
    price,
    category,
    stock,
    variants,
    images,
    hsnCode,
    lowStockThreshold,
    isNewArrival,
    rating,
    reviewCount,
  } = req.body; // validated by schemas.productCreate (name, price and category required)

  const product = await Product.create({
    name,
    description,
    price,
    category,
    stock: stock || 0,
    variants: variants || [],
    images: images || [],
    ...(hsnCode !== undefined && { hsnCode }),
    ...(lowStockThreshold !== undefined && { lowStockThreshold }),
    ...(isNewArrival !== undefined && { isNewArrival }),
    ...(rating !== undefined && { rating }),
    ...(reviewCount !== undefined && { reviewCount }),
  });

  res.status(201).json(product);
};

/**
 * @route   PUT /api/products/:id
 * @access  Private/Admin
 */
const updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  // Snapshot BEFORE applying changes, so we can tell afterwards whether stock
  // just crossed from "out of stock" to "available" (triggers notify-me emails).
  const wasOutOfStock = isFullyOutOfStock(product);

  const {
    name,
    description,
    price,
    category,
    stock,
    variants,
    images,
    isActive,
    hsnCode,
    lowStockThreshold,
    isNewArrival,
    rating,
    reviewCount,
  } = req.body;

  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = price;
  if (category !== undefined) product.category = category;
  if (stock !== undefined) product.stock = stock;
  if (variants !== undefined) product.variants = variants;
  if (images !== undefined) product.images = images;
  if (isActive !== undefined) product.isActive = isActive;
  if (hsnCode !== undefined) product.hsnCode = hsnCode;
  if (lowStockThreshold !== undefined) product.lowStockThreshold = lowStockThreshold;
  if (isNewArrival !== undefined) product.isNewArrival = isNewArrival;
  if (rating !== undefined) product.rating = rating;
  if (reviewCount !== undefined) product.reviewCount = reviewCount;

  const updated = await product.save();
  await notifyIfBackInStock(updated, wasOutOfStock);

  res.json(updated);
};

/**
 * @route   DELETE /api/products/:id
 * @access  Private/Admin
 */
const deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  await product.deleteOne();
  res.json({ message: "Product deleted" });
};

/**
 * @route   POST /api/products/:id/notify
 * @desc    Ask to be emailed when this out-of-stock product is available again
 * @access  Private
 */
const requestStockNotification = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const alreadyRequested = product.notifyRequests.some(
    (id) => id.toString() === req.user._id.toString()
  );
  if (!alreadyRequested) {
    product.notifyRequests.push(req.user._id);
    await product.save();
  }

  res.json({ message: "We'll email you as soon as this is back in stock" });
};

/**
 * @route   POST /api/products/:id/broadcast-new-arrival
 * @desc    Sends a WhatsApp broadcast about this product to every opted-in customer.
 *          Deliberately admin-triggered (a button, with a confirmation prompt on the
 *          frontend) rather than automatic on product creation, to avoid accidental spam.
 * @access  Private/Admin
 */
const broadcastNewArrival = async (req, res) => {
  const product = await Product.findById(req.params.id).populate("category", "name");
  if (!product) return res.status(404).json({ message: "Product not found" });

  const recipients = await User.find({ whatsappOptIn: true, whatsappNumber: { $ne: "" } }).select(
    "whatsappNumber"
  );

  const message = `New arrival at Ashoka Traders: ${product.name}${
    product.category ? ` (${product.category.name})` : ""
  } - now Rs.${product.price}. Check it out!`;
  const result = await sendWhatsAppBroadcast(
    recipients.map((u) => u.whatsappNumber),
    message
  );

  res.json({ recipientCount: recipients.length, ...result });
};

/**
 * @route   POST /api/products/bulk-upload
 * @desc    Upload a CSV (columns: productId, stock, price [optional]) to bulk-update
 *          stock/price. Existing single-product edit form keeps working alongside this.
 * @access  Private/Admin
 */
const bulkUploadProducts = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No CSV file uploaded" });
  }

  // Parse the uploaded buffer into an array of row objects, keyed by CSV header.
  const rows = await new Promise((resolve, reject) => {
    const parsed = [];
    Readable.from(req.file.buffer.toString("utf-8"))
      .pipe(csvParser())
      .on("data", (row) => parsed.push(row))
      .on("end", () => resolve(parsed))
      .on("error", reject);
  });

  let updatedCount = 0;
  const failures = [];

  for (const [index, row] of rows.entries()) {
    const rowNum = index + 2; // +1 for the header row, +1 for 1-indexing
    const productId = (row.productId || row.sku || row.id || "").trim();
    const rawStock = row.stock;
    const rawPrice = row.price;

    if (!productId) {
      failures.push({ row: rowNum, reason: "Missing productId/sku column" });
      continue;
    }

    const product = await Product.findById(productId).catch(() => null);
    if (!product) {
      failures.push({ row: rowNum, productId, reason: "Product not found" });
      continue;
    }

    const wasOutOfStock = isFullyOutOfStock(product);
    let hadInvalidValue = false;

    if (rawStock !== undefined && rawStock !== "") {
      const stockNum = Number(rawStock);
      if (Number.isNaN(stockNum) || stockNum < 0) {
        failures.push({ row: rowNum, productId, reason: "Invalid stock value" });
        hadInvalidValue = true;
      } else {
        product.stock = stockNum;
      }
    }
    if (rawPrice !== undefined && rawPrice !== "") {
      const priceNum = Number(rawPrice);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        failures.push({ row: rowNum, productId, reason: "Invalid price value" });
        hadInvalidValue = true;
      } else {
        product.price = priceNum;
      }
    }

    if (hadInvalidValue) continue;

    await product.save();
    await notifyIfBackInStock(product, wasOutOfStock);
    updatedCount++;
  }

  res.json({ updatedCount, failedCount: failures.length, failures });
};

module.exports = {
  getProducts,
  getBestSellers,
  getProductById,
  getProductBySlug,
  getRelatedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  requestStockNotification,
  broadcastNewArrival,
  bulkUploadProducts,
};
