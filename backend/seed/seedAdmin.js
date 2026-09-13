/**
 * One-off script to create the single admin account.
 * Run it with: npm run seed:admin
 *
 * It reads ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD from .env.
 * Safe to run more than once - it skips creation if that email already exists.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

const run = async () => {
  await connectDB();

  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    process.exit(1);
  }

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log(`Admin account already exists for ${ADMIN_EMAIL} - nothing to do.`);
    process.exit(0);
  }

  const admin = await User.create({
    name: ADMIN_NAME || "Admin",
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD, // hashed automatically by the User model's pre-save hook
    isAdmin: true,
  });

  console.log(`Admin account created: ${admin.email}`);
  process.exit(0);
};

run().catch((error) => {
  console.error("Failed to seed admin:", error);
  process.exit(1);
});
