const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const addressSchema = require("./addressSchema");
const cartItemSchema = require("./cartItemSchema");

/**
 * A single User model is used for both customers and the admin.
 * The "isAdmin" flag distinguishes the admin account - there is only
 * ever meant to be one admin, created via the seed script (seed/seedAdmin.js).
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false, // never return the hashed password in queries by default
    },
    phone: {
      type: String,
      trim: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    // Saved shipping address, filled in the first time a customer checks out
    // (see PUT /api/auth/address). Optional - undefined until they save one.
    address: {
      type: addressSchema,
      default: undefined,
    },
    // Product ids the customer has saved for later (see /api/wishlist routes)
    wishlist: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Product",
      default: [],
    },
    // The customer's saved cart (see /api/cart routes). Guests keep theirs in
    // localStorage instead; it's merged in here when they log in.
    cart: {
      type: [cartItemSchema],
      default: [],
    },
    // Promotional WhatsApp consent (new arrivals / offer broadcasts - see
    // utils/whatsappService.js). Transactional messages (order confirmations) don't
    // check this flag - only whether whatsappNumber is present at all.
    whatsappOptIn: {
      type: Boolean,
      default: false,
    },
    whatsappNumber: {
      type: String,
      trim: true,
      default: "",
    },
    // Timestamp of when the customer last turned opt-in ON, kept as a compliance record
    // of consent - not touched when they opt back out, so the history of consent stays intact.
    whatsappOptInDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Hash the password before saving, but only if it was modified (avoids re-hashing on every save)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare a plaintext password against the stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
