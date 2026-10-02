/**
 * Shared test harness.
 *
 * Every test file gets a throwaway MongoDB (an in-memory single-node replica set, because
 * the order code uses transactions) and the real Express app from app.js. Nothing external
 * is contacted: SMTP, WhatsApp and Cloudinary are left unconfigured, so those utilities
 * fall back to their built-in "log instead of send" stubs, and Razorpay is stubbed here.
 */
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");

// Must be set before app.js (and anything reading config/env.js) is required.
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-not-used-anywhere-real";
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_key";
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "rzp_test_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "test_webhook_secret";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin-alerts@example.test";
delete process.env.SMTP_HOST; // keep emails as console stubs
delete process.env.WHATSAPP_API_URL;

let replSet;

/** Boots the in-memory database. Call from a test file's `before`. */
async function startDb() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri("ashoka_test"));
}

/** Tears everything down. Call from `after`. */
async function stopDb() {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}

/** Empties every collection between tests so each one starts from a known state. */
async function clearDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

/** The real app, with its own routes/middleware - mounted without binding a port. */
function getApp() {
  return require("../../app");
}

// --- Fixtures -------------------------------------------------------------------------

const User = require("../../models/User");
const Category = require("../../models/Category");
const Product = require("../../models/Product");
const Settings = require("../../models/Settings");

const PASSWORD = "TestPass!2345";

async function makeUser({ email = "customer@test.local", isAdmin = false, name = "Test Customer" } = {}) {
  return User.create({ name, email, password: PASSWORD, isAdmin });
}

async function makeAdmin() {
  return makeUser({ email: "admin@test.local", isAdmin: true, name: "Test Admin" });
}

/** Logs in through the real endpoint, so the token is produced exactly as in production. */
async function login(request, email) {
  const res = await request.post("/api/auth/login").send({ email, password: PASSWORD });
  if (!res.body.token) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function makeProduct({ name = "Test Almonds", price = 100, stock = 10, variants = [] } = {}) {
  const category = (await Category.findOne()) || (await Category.create({ name: "Dry Fruits" }));
  return Product.create({ name, price, stock, category: category._id, isActive: true, variants });
}

async function makeSettings(overrides = {}) {
  await Settings.deleteMany({});
  return Settings.create({ freeShippingThreshold: 1000, flatShippingFee: 49, minimumOrderValue: 0, ...overrides });
}

const ADDRESS = {
  name: "Test Customer",
  phone: "9876543210",
  addressLine: "12 Rajpur Road",
  pincode: "248001",
  city: "Dehradun",
  state: "Uttarakhand",
};

module.exports = { startDb, stopDb, clearDb, getApp, makeUser, makeAdmin, makeProduct, makeSettings, login, auth, ADDRESS, PASSWORD };
