const express = require("express");
const multer = require("multer");
const router = express.Router();
const {
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
} = require("../controllers/productController");
const { protect, admin } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

// CSV/image files are small - keep uploads in memory rather than writing to disk first.
const upload = multer({ storage: multer.memoryStorage() });

// Public reads
router.get("/", asyncHandler(getProducts));
router.get("/best-sellers", asyncHandler(getBestSellers)); // literal path - must come before "/:id"
router.get("/slug/:slug", asyncHandler(getProductBySlug)); // SEO-friendly lookup, used by the storefront
router.get("/:id/related", asyncHandler(getRelatedProducts)); // 2-segment path, so no conflict with "/:id" below
router.get("/:id", asyncHandler(getProductById));

// Admin-only writes
router.post("/", protect, admin, asyncHandler(createProduct));
router.post("/bulk-upload", protect, admin, upload.single("file"), asyncHandler(bulkUploadProducts));
router.put("/:id", protect, admin, asyncHandler(updateProduct));
router.delete("/:id", protect, admin, asyncHandler(deleteProduct));
router.post("/:id/broadcast-new-arrival", protect, admin, asyncHandler(broadcastNewArrival));

// Logged-in customers
router.post("/:id/notify", protect, asyncHandler(requestStockNotification));

module.exports = router;
