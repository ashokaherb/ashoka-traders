const Category = require("../models/Category");

// The storefront's nav bar is a single-line horizontal strip - only room for a
// handful of direct category links (see NavBar.jsx). Kept in one place so the admin
// UI and this server-side check always agree on the limit.
const MAX_NAV_CATEGORIES = 4;

/**
 * Rejects turning showInNav on for a category if that would push the featured count
 * past MAX_NAV_CATEGORIES - checked here (not just in the admin form) so the limit
 * can't be bypassed by calling the API directly.
 */
const assertNavSlotAvailable = async (excludeId) => {
  const count = await Category.countDocuments({
    showInNav: true,
    ...(excludeId && { _id: { $ne: excludeId } }),
  });
  if (count >= MAX_NAV_CATEGORIES) {
    const err = new Error(
      `Only ${MAX_NAV_CATEGORIES} categories can be shown in the nav bar - remove one first.`
    );
    err.status = 400;
    throw err;
  }
};

/**
 * @route   GET /api/categories
 * @desc    List all categories
 * @access  Public
 */
const getCategories = async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json(categories);
};

/**
 * @route   GET /api/categories/:id
 * @access  Public
 */
const getCategoryById = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: "Category not found" });
  res.json(category);
};

/**
 * @route   POST /api/categories
 * @access  Private/Admin
 */
const createCategory = async (req, res) => {
  try {
    const { name, description, image, showInNav } = req.body;
    if (!name) return res.status(400).json({ message: "Category name is required" });

    if (showInNav) await assertNavSlotAvailable();

    const category = await Category.create({ name, description, image, showInNav });
    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "A category with this name already exists" });
    }
    res.status(error.status || 500).json({ message: error.message || "Could not create category" });
  }
};

/**
 * @route   PUT /api/categories/:id
 * @access  Private/Admin
 */
const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    // Only re-check the nav slot limit if this update is actually turning the flag ON
    // (switching it off, or leaving an already-featured category featured, never needs it).
    if (req.body.showInNav && !category.showInNav) {
      await assertNavSlotAvailable(category._id);
    }

    category.name = req.body.name ?? category.name;
    category.description = req.body.description ?? category.description;
    category.image = req.body.image ?? category.image;
    category.showInNav = req.body.showInNav ?? category.showInNav;
    const updated = await category.save();
    res.json(updated);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || "Could not update category" });
  }
};

/**
 * @route   DELETE /api/categories/:id
 * @access  Private/Admin
 */
const deleteCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: "Category not found" });

  await category.deleteOne();
  res.json({ message: "Category deleted" });
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
