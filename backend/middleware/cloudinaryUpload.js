const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Multer's storage engine uploads straight to Cloudinary as each file arrives -
// nothing ever touches this server's disk, which matters on hosts like Railway
// where the filesystem is wiped on every redeploy.
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "ashoka-traders/products",
    // Cap the stored image at 1000px wide (taller/narrower images are left alone -
    // "limit" never upscales or crops) and let Cloudinary pick the best format/
    // compression per-viewer (e.g. WebP/AVIF on browsers that support it).
    transformation: [{ width: 1000, crop: "limit" }, { quality: "auto", fetch_format: "auto" }],
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

// 5MB per file is generous for a product photo; reject anything that isn't an
// image outright rather than letting Cloudinary reject it after the upload starts.
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

module.exports = upload;
