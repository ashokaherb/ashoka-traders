const Banner = require("../models/Banner");

/**
 * @route   GET /api/banners/active
 * @desc    Active banners for the storefront's homepage carousel, in display order.
 * @access  Public
 */
const getActiveBanners = async (req, res) => {
  const banners = await Banner.find({ active: true }).sort({ order: 1 });
  res.json(banners);
};

/**
 * @route   GET /api/banners
 * @desc    Every banner (active or not), for the admin's Banners page.
 * @access  Private/Admin
 */
const getAllBanners = async (req, res) => {
  const banners = await Banner.find().sort({ order: 1 });
  res.json(banners);
};

/**
 * @route   POST /api/banners
 * @desc    Create a banner slide. New slides go to the end of the list (reorder
 *          afterward from the admin UI if it should appear earlier).
 * @access  Private/Admin
 */
const createBanner = async (req, res) => {
  try {
    const { image, title, linkUrl, active } = req.body;
    if (!image) return res.status(400).json({ message: "Banner image is required" });

    const count = await Banner.countDocuments();
    const banner = await Banner.create({
      image,
      title,
      linkUrl,
      active: active ?? true,
      order: count,
    });
    res.status(201).json(banner);
  } catch (error) {
    res.status(500).json({ message: "Could not create banner", error: error.message });
  }
};

/**
 * @route   PUT /api/banners/:id
 * @access  Private/Admin
 */
const updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });

    banner.image = req.body.image ?? banner.image;
    banner.title = req.body.title ?? banner.title;
    banner.linkUrl = req.body.linkUrl ?? banner.linkUrl;
    banner.active = req.body.active ?? banner.active;
    const updated = await banner.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Could not update banner", error: error.message });
  }
};

/**
 * @route   DELETE /api/banners/:id
 * @access  Private/Admin
 */
const deleteBanner = async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) return res.status(404).json({ message: "Banner not found" });

  await banner.deleteOne();
  res.json({ message: "Banner deleted" });
};

/**
 * @route   PUT /api/banners/reorder
 * @desc    Persists a new display order after the admin moves slides up/down - body
 *          is { orderedIds: [id, id, ...] } listing every banner id in its new order.
 * @access  Private/Admin
 */
const reorderBanners = async (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ message: "orderedIds must be a non-empty array" });
  }

  await Promise.all(orderedIds.map((id, index) => Banner.updateOne({ _id: id }, { order: index })));
  const banners = await Banner.find().sort({ order: 1 });
  res.json(banners);
};

module.exports = {
  getActiveBanners,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  reorderBanners,
};
