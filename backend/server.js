require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");
const connectDB = require("./config/db");
const { verifyEmailSetup } = require("./utils/sendEmail");
const { NODE_ENV, isProduction, TRUST_PROXY, checkProductionConfig } = require("./config/env");
const errorHandler = require("./middleware/errorHandler");
const {
  loginLimiters,
  registerLimiter,
  couponValidateLimiter,
  contactLimiter,
} = require("./middleware/rateLimiters");

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

// In production, stop here if a setting would be insecure (e.g. placeholder JWT_SECRET)
checkProductionConfig();

// Connect to MongoDB before anything else
connectDB();

const app = express();

// Behind Render's proxy, read the real visitor IP from X-Forwarded-For - rate limits
// depend on it (see TRUST_PROXY in config/env.js, and /api/debug/ip below to verify it).
app.set("trust proxy", TRUST_PROXY);
app.disable("x-powered-by"); // don't advertise "Express" (helmet also removes it)

// --- Security headers (audit M13) ---
// This server only returns JSON (plus the sitemap XML and invoice PDFs), never web pages,
// so its Content-Security-Policy can be locked right down: nothing may load, run, or frame
// an API response. The CSP that protects the actual shop pages is set where those pages
// are hosted - see storefront/securityHeaders.js / admin/securityHeaders.js (Vercel vercel.json).
// helmet also sets HSTS (HTTPS only, 1 year), X-Content-Type-Options: nosniff,
// X-Frame-Options, Referrer-Policy and friends.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
  })
);

// --- Middleware ---
// Only allow requests from our own storefront/admin apps (plus no-origin tools like Postman/curl)
const allowedOrigins = [process.env.STOREFRONT_URL, process.env.ADMIN_URL].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // 403, not a generic 500 - the request is refused, the server isn't broken
        callback(Object.assign(new Error("Not allowed by CORS"), { status: 403 }));
      }
    },
  })
);
app.use(express.json()); // parse JSON request bodies

// NoSQL operator injection guard (audit M1). Express turns ?category[$ne]=x into
// { category: { $ne: "x" } }, and a JSON body can carry { "email": { "$gt": "" } } - passed
// into a Mongo filter, those become query operators. This strips every key starting with
// "$" or containing "." from req.body, req.query and req.headers before any route sees them.
// Controllers still type-check the values they use (belt and braces).
app.use(
  mongoSanitize({
    onSanitize: ({ req, key }) =>
      console.warn(`[INJECTION ATTEMPT BLOCKED] ${req.method} ${req.originalUrl} - stripped operator keys from req.${key} (ip ${req.ip})`),
  })
);

// Request logging: every request in development; in production only failed requests
// (4xx/5xx), in the standard "combined" format with IP + user agent for investigating abuse.
app.use(
  isProduction
    ? morgan("combined", { skip: (req, res) => res.statusCode < 400 })
    : morgan("dev")
);

// --- Rate limits (audit H2) - must come after express.json(), the login limiter reads the email ---
app.use("/api/auth/login", loginLimiters);
app.use("/api/auth/register", registerLimiter);
app.use("/api/coupons/validate", couponValidateLimiter);
app.use("/api/contact", contactLimiter);

// --- Routes ---
app.get("/", (req, res) => {
  res.json({ message: "Ashoka Traders API is running" });
});

// Simple health check for uptime monitors / hosting platforms (Render's Health Check Path).
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// TEMPORARY proxy check - confirms TRUST_PROXY is right on the live host, so rate limits see
// each visitor's real IP (DEPLOYMENT.md, "Verify TRUST_PROXY"). The route only exists while
// DEBUG_IP_ENDPOINT=true: turn it on, run the check, then delete the variable again.
if (process.env.DEBUG_IP_ENDPOINT === "true") {
  console.warn("[config warning] DEBUG_IP_ENDPOINT is on - remove it once TRUST_PROXY is verified");
  app.get("/api/debug/ip", (req, res) => {
    res.json({
      ip: req.ip, // the IP the rate limiter will use for this visitor
      trustProxy: TRUST_PROXY,
      xForwardedFor: req.headers["x-forwarded-for"] || null,
    });
  });
}

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
  console.log(`Server running on http://localhost:${PORT} (${NODE_ENV} mode)`);
  verifyEmailSetup(); // logs "[EMAIL] SMTP login OK" or the exact reason it fails
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
// cleanly (PM2, Render), consider exiting here instead.
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION (server kept alive - fix the source):", error);
});
