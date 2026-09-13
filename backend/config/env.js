/**
 * The ONE place the backend reads NODE_ENV. Import `isProduction` from here instead of
 * checking process.env.NODE_ENV directly, so every file agrees on what "production" means.
 * (Audit finding M12.)
 *
 *   NODE_ENV=production   on the live server (Render environment variables) - hides error details
 *                         from API responses, quieter request logs, proxy-aware IPs
 *   unset / development   locally - detailed errors and full request logs for debugging
 */
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

/**
 * How many reverse proxies sit in front of the app. On Render, requests reach the app through
 * one proxy hop that adds the visitor's IP to X-Forwarded-For, so production defaults to 1.
 * This matters for rate limiting: set too LOW, every visitor looks like the proxy's IP and
 * one person's failed logins lock out all customers; set too HIGH, attackers can fake their
 * IP in the header and dodge the limits. Render doesn't publish an exact hop count, so
 * confirm it once after deploying (DEPLOYMENT.md, "Verify TRUST_PROXY") and override with
 * TRUST_PROXY only if that check says so. 0 = no proxy (local development).
 */
const TRUST_PROXY = process.env.TRUST_PROXY !== undefined ? Number(process.env.TRUST_PROXY) : isProduction ? 1 : 0;

/**
 * In production, refuse to start with settings that would be insecure, and warn about
 * ones that are probably a mistake. Called once from server.js at startup.
 */
function checkProductionConfig() {
  if (!isProduction) return;

  const fatal = [];
  const secret = process.env.JWT_SECRET || "";
  if (secret.length < 32 || secret === "replace_with_a_long_random_string") {
    fatal.push("JWT_SECRET is missing, a placeholder, or shorter than 32 characters - anyone could forge logins");
  }
  if (!process.env.STOREFRONT_URL || !process.env.ADMIN_URL) {
    fatal.push("STOREFRONT_URL and ADMIN_URL must be set - CORS would block the live sites");
  }
  if (fatal.length) {
    console.error(`\nRefusing to start in production:\n  - ${fatal.join("\n  - ")}\n`);
    process.exit(1);
  }

  const warnings = [];
  if ((process.env.RAZORPAY_KEY_ID || "").startsWith("rzp_test_")) warnings.push("Razorpay is using TEST keys - no real payments will be collected");
  if (!process.env.SMTP_HOST) warnings.push("SMTP is not configured - order and admin emails will only be logged, not sent");
  if (!process.env.ADMIN_EMAIL) warnings.push("ADMIN_EMAIL is not set - admin alert emails have nowhere to go");
  warnings.forEach((w) => console.warn(`[config warning] ${w}`));
}

module.exports = { NODE_ENV, isProduction, TRUST_PROXY, checkProductionConfig };
