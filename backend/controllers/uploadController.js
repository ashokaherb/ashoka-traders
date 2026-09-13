// By the time a request reaches here, middleware/cloudinaryUpload.js has already
// uploaded each file straight to Cloudinary (that's what the CloudinaryStorage
// engine does inside multer) - this just reads the resulting URLs back off req.files.

/**
 * @route   POST /api/upload
 * @desc    Uploads one or more product images to Cloudinary (field name "images",
 *          up to 6 per request) and returns their hosted URLs, ready to drop straight
 *          into Product.images.
 * @access  Private/Admin
 */
const uploadImages = (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No images uploaded" });
  }

  // CloudinaryStorage puts the uploaded file's secure URL on `.path`.
  const urls = req.files.map((file) => file.path);
  res.json({ urls });
};

module.exports = { uploadImages };
