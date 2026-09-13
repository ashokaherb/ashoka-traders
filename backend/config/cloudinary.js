const cloudinary = require("cloudinary").v2;

// Configured once from env vars, then required wherever an upload happens
// (currently just middleware/cloudinaryUpload.js). Values come from the
// Cloudinary dashboard - see .env.example.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
