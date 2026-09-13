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
const validate = require("../middleware/validate");
const schemas = require("../validation/schemas");

// NOTE: "/my" and "/export" must both be registered before "/:id", otherwise Express
// would match them as if "my"/"export" were an order id.
router.post("/", protect, validate(schemas.codOrder), asyncHandler(createOrder)); // COD
router.post("/razorpay", protect, validate(schemas.razorpayOrder), asyncHandler(createRazorpayOrder));
router.post("/razorpay/verify", protect, validate(schemas.razorpayVerify), asyncHandler(verifyRazorpayPayment));
router.get("/my", protect, asyncHandler(getMyOrders));
router.get("/export", protect, admin, asyncHandler(exportOrdersCSV));
router.get("/", protect, admin, asyncHandler(getAllOrders));
router.get("/:id/invoice", protect, asyncHandler(downloadInvoice)); // 2-segment path, no conflict with "/:id"
router.get("/:id", protect, asyncHandler(getOrderById));
router.put("/:id/status", protect, admin, validate(schemas.orderStatusUpdate), asyncHandler(updateOrderStatus));

module.exports = router;
