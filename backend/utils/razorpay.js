const Razorpay = require("razorpay");

/**
 * A single shared Razorpay client, built from the test/live keys in .env.
 * Stays `null` if the keys aren't set yet, so the rest of the app can check
 * for that and return a friendly error instead of crashing.
 */
let razorpayInstance = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn("Razorpay keys not set - online payment will be unavailable until RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are set in .env");
}

module.exports = razorpayInstance;
