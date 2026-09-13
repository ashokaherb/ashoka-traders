require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const couponRoutes = require("./routes/couponRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const utilityRoutes = require("./routes/utilityRoutes");
const offerRoutes = require("./routes/offerRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const sitemapRoutes = require("./routes/sitemapRoutes");
const contactRoutes = require("./routes/contactRoutes");
const cartRoutes = require("./routes/cartRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const bannerRoutes = require("./routes/bannerRoutes");

// Connect to MongoDB before anything else
connectDB();

const app = express();

// --- Middleware ---
// Only allow requests from our own storefront/admin apps (plus no-origin tools like Postman/curl)
const allowedOrigins = [process.env.STOREFRONT_URL, process.env.ADMIN_URL].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);
app.use(express.json()); // parse JSON request bodies
app.use(morgan("dev")); // log requests to the console during development

// --- Routes ---
app.get("/", (req, res) => {
  res.json({ message: "Ashoka Traders API is running" });
});

// Simple health check for uptime monitors / hosting platforms (e.g. Railway, a load balancer).
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use("/sitemap.xml", sitemapRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/utils", utilityRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/banners", bannerRoutes);

// --- 404 handler (no route matched) ---
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// --- Central error handler (must be mounted last) ---
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// --- Last-resort process guards (defence in depth) ---
// asyncHandler should mean nothing reaches these. They exist so that if something
// ever slips past it (a stray .then() with no .catch(), a background timer, a driver
// event), the shop stays up instead of the whole process dying mid-request.
//
// Anything logged here is a BUG to fix at its source, not something to leave running -
// check the server logs for these after deploying.
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION (server kept alive - fix the source):", reason);
});

// NOTE: after an uncaughtException the process is, strictly speaking, in an unknown
// state - Node's own guidance is to log and restart. We keep it alive deliberately:
// for a single-instance shop, staying up with one failed request beats every customer
// getting a connection error. If you later run under a process manager that restarts
// cleanly (PM2, Railway), consider exiting here instead.
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION (server kept alive - fix the source):", error);
});
