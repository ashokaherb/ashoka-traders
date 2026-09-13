const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

/**
 * Rate limits for the endpoints attackers (or bots) hit repeatedly. (Audit finding H2.)
 * Mounted in server.js, after express.json() so the login limiter can read the email.
 *
 * Counts are kept in memory - fine for a single server. They reset when the server
 * restarts, and would need a shared store (e.g. Redis) if you ever run several instances.
 *
 * Each IP is identified via req.ip, which is only the real visitor IP if "trust proxy" is
 * set correctly behind Railway's proxy - see TRUST_PROXY in config/env.js.
 */

const minutesUntil = (resetTime) => Math.max(1, Math.ceil((resetTime - Date.now()) / 60000));

// Shared settings: a clear 429 JSON message, and the standard RateLimit / Retry-After headers
const baseOptions = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const minutes = minutesUntil(req.rateLimit.resetTime);
    res.status(options.statusCode).json({
      message: `Too many attempts, try again later (in about ${minutes} minute${minutes === 1 ? "" : "s"}).`,
      code: "RATE_LIMITED",
    });
  },
};

// ipKeyGenerator groups IPv6 addresses by network, so someone with a whole IPv6 block
// can't dodge the limit by changing the last few digits of their address.
const ipKey = (req) => ipKeyGenerator(req.ip);

/**
 * LOGIN - two limits, both counting only FAILED attempts (skipSuccessfulRequests), so a
 * customer who logs in correctly never uses anything up:
 *
 *  1. 5 failures per IP + email per 15 min - stops password guessing on one account.
 *     Keyed on IP AND email, not IP alone, because many Indian mobile users share one
 *     public IP (carrier-grade NAT): an IP-only limit of 5 would let one person's typos
 *     lock out every other customer on the same network.
 *  2. 30 failures per IP per 15 min - stops one IP trying passwords across many accounts
 *     (credential stuffing), while leaving room for a shared network's honest mistakes.
 */
const loginPerAccountLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKey(req)}|${String(req.body?.email || "").trim().toLowerCase()}`,
});

const loginPerIpLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  keyGenerator: ipKey,
});

// REGISTER - 5 account creations per IP per 15 min (every attempt counts; stops bulk fake signups)
const registerLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: ipKey,
});

// COUPON VALIDATE - 10 checks per IP per 15 min, so codes can't be guessed by trying thousands
const couponValidateLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: ipKey,
});

// CONTACT FORM - 3 submissions per IP per hour. Every submission sends a real email AND a
// WhatsApp message to the admin, and WhatsApp messages cost money once the BSP is connected.
const contactLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: ipKey,
  handler: (req, res, next, options) => {
    const minutes = minutesUntil(req.rateLimit.resetTime);
    res.status(options.statusCode).json({
      message: `You've sent several messages recently. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}, or call/WhatsApp us directly.`,
      code: "RATE_LIMITED",
    });
  },
});

module.exports = {
  loginLimiters: [loginPerIpLimiter, loginPerAccountLimiter],
  registerLimiter,
  couponValidateLimiter,
  contactLimiter,
};
