const express = require("express");
const router = express.Router();
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { protect, admin } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

// Public reads
router.get("/", asyncHandler(getCategories));
router.get("/:id", asyncHandler(getCategoryById));

// Admin-only writes
router.post("/", protect, admin, asyncHandler(createCategory));
router.put("/:id", protect, admin, asyncHandler(updateCategory));
router.delete("/:id", protect, admin, asyncHandler(deleteCategory));

module.exports = router;
