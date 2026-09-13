/**
 * One-off script to create the single admin account.
 * Run it with: npm run seed:admin
 *
 * Reads ADMIN_NAME / ADMIN_EMAIL from .env. For the password:
 *   - ADMIN_PASSWORD left blank (recommended) -> a strong random password is generated
 *     and printed ONCE in the terminal. It is never saved anywhere else, so copy it into
 *     a password manager straight away.
 *   - ADMIN_PASSWORD set -> used, but only if it's at least 12 characters and not a known
 *     placeholder like "changeme123". A weak value stops the script instead of creating
 *     an admin anyone could guess.
 *
 * Safe to run more than once - it skips creation if that email already exists
 * (and never prints or changes an existing admin's password).
 */
require("dotenv").config();
const crypto = require("crypto");
const connectDB = require("../config/db");
const User = require("../models/User");

const MIN_PASSWORD_LENGTH = 12;
const KNOWN_WEAK_PASSWORDS = ["changeme123", "changeme", "password", "password123", "admin", "admin123", "12345678"];

// 18 random bytes -> 24 URL-safe characters (~144 bits of randomness)
const generatePassword = () => crypto.randomBytes(18).toString("base64url");

const run = async () => {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_EMAIL) {
    console.error("ADMIN_EMAIL must be set in .env");
    process.exit(1);
  }

  let password = ADMIN_PASSWORD && ADMIN_PASSWORD.trim();
  let generated = false;

  if (password) {
    if (KNOWN_WEAK_PASSWORDS.includes(password.toLowerCase()) || password.length < MIN_PASSWORD_LENGTH) {
      console.error(
        `ADMIN_PASSWORD in .env is too weak (placeholder or under ${MIN_PASSWORD_LENGTH} characters).\n` +
          "Either set a strong password, or leave ADMIN_PASSWORD blank to have one generated for you."
      );
      process.exit(1);
    }
  } else {
    password = generatePassword();
    generated = true;
  }

  await connectDB();

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log(`Admin account already exists for ${ADMIN_EMAIL} - nothing to do.`);
    process.exit(0);
  }

  const admin = await User.create({
    name: ADMIN_NAME || "Admin",
    email: ADMIN_EMAIL,
    password, // hashed automatically by the User model's pre-save hook
    isAdmin: true,
  });

  console.log(`Admin account created: ${admin.email}`);
  if (generated) {
    console.log("\n==================================================================");
    console.log("  GENERATED ADMIN PASSWORD - shown only this once:");
    console.log(`\n      ${password}\n`);
    console.log("  Save it in a password manager now. It is not stored anywhere");
    console.log("  in plain text and cannot be shown again.");
    console.log("==================================================================\n");
  }
  process.exit(0);
};

run().catch((error) => {
  console.error("Failed to seed admin:", error);
  process.exit(1);
});
