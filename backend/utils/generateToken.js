const jwt = require("jsonwebtoken");

/**
 * JWT lifetimes (audit finding H5). Admin access is higher-risk, so admin tokens expire
 * much sooner than customer tokens - a leaked admin token is only useful for a day.
 *
 *   JWT_EXPIRES_IN        customer token lifetime          (default 7d)
 *   JWT_ADMIN_EXPIRES_IN  admin token lifetime             (default 24h)
 *   JWT_MAX_SESSION       how long a customer can keep silently refreshing before they
 *                         must type their password again  (default 30d)
 *
 * Formats: a number followed by s / m / h / d - e.g. "90m", "24h", "7d".
 */
const toSeconds = (value, name) => {
  const match = /^(\d+)\s*([smhd])$/.exec(String(value).trim());
  if (!match) {
    // Fail loudly at startup - a typo here would otherwise silently change session security
    throw new Error(`${name} must look like "24h" or "7d" (got "${value}")`);
  }
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
  return Number(match[1]) * unit;
};

const CUSTOMER_TTL_SECONDS = toSeconds(process.env.JWT_EXPIRES_IN || "7d", "JWT_EXPIRES_IN");
const ADMIN_TTL_SECONDS = toSeconds(process.env.JWT_ADMIN_EXPIRES_IN || "24h", "JWT_ADMIN_EXPIRES_IN");
const MAX_SESSION_SECONDS = toSeconds(process.env.JWT_MAX_SESSION || "30d", "JWT_MAX_SESSION");

/** How long a token may live for this user, based on their role. */
const tokenTtlFor = (user) => (user.isAdmin ? ADMIN_TTL_SECONDS : CUSTOMER_TTL_SECONDS);

/**
 * Creates a signed JWT for a user. The token is returned to the client and sent back on
 * every request as "Authorization: Bearer <token>" (see middleware/auth.js).
 *
 * Payload:
 *   id       - the user's Mongo _id
 *   authTime - when the user last actually entered their password (unix seconds).
 *              Carried over unchanged by /auth/refresh, so refreshing can't extend a
 *              session forever - see JWT_MAX_SESSION.
 *
 * @param {object} user - the User document (needs _id and isAdmin)
 * @param {object} [options]
 * @param {number} [options.authTime] - keep the original login time (used when refreshing)
 */
const generateToken = (user, { authTime } = {}) => {
  return jwt.sign(
    { id: user._id, authTime: authTime ?? Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET,
    { expiresIn: tokenTtlFor(user) }
  );
};

module.exports = generateToken;
module.exports.tokenTtlFor = tokenTtlFor;
module.exports.MAX_SESSION_SECONDS = MAX_SESSION_SECONDS;
