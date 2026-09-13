const express = require("express");
const router = express.Router();
const {
  createOrder,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getMyOrders,
  getOrderById,
  getAllOrders,
  exportOrdersCSV,
  updateOrderStatus,
  downloadInvoice,
} = require("../controllers/orderController");
const { protect, admin } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

// NOTE: "/my" and "/export" must both be registered before "/:id", otherwise Express
// would match them as if "my"/"export" were an order id.
router.post("/", protect, asyncHandler(createOrder)); // COD
router.post("/razorpay", protect, asyncHandler(createRazorpayOrder));
router.post("/razorpay/verify", protect, asyncHandler(verifyRazorpayPayment));
router.get("/my", protect, asyncHandler(getMyOrders));
router.get("/export", protect, admin, asyncHandler(exportOrdersCSV));
router.get("/", protect, admin, asyncHandler(getAllOrders));
router.get("/:id/invoice", protect, asyncHandler(downloadInvoice)); // 2-segment path, no conflict with "/:id"
router.get("/:id", protect, asyncHandler(getOrderById));
router.put("/:id/status", protect, admin, asyncHandler(updateOrderStatus));

module.exports = router;
