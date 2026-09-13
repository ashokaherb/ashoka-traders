const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { tokenTtlFor } = require("../utils/generateToken");

/**
 * "protect" checks for a valid JWT in the Authorization header and,
 * if valid, attaches the matching user document to req.user.
 * Use this on any route that requires a logged-in user.
 *
 * Expired sessions get `code: "SESSION_EXPIRED"` in the response, so the storefront and
 * admin apps can show "please log in again" instead of a generic error.
 */
const protect = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Your session has expired. Please log in again.", code: "SESSION_EXPIRED" });
    }
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }

  req.user = await User.findById(decoded.id); // password excluded by schema's select:false
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized, user no longer exists" });
  }

  // Enforce the lifetime for the account's CURRENT role, measured from when the token was
  // issued - not just the token's own "exp". This matters because:
  //   - tokens issued before this rule existed carried a 30-day exp; this cuts them off
  //   - an account promoted to admin can't keep using a long-lived customer token
  const ageSeconds = Math.floor(Date.now() / 1000) - decoded.iat;
  if (ageSeconds > tokenTtlFor(req.user)) {
    return res.status(401).json({ message: "Your session has expired. Please log in again.", code: "SESSION_EXPIRED" });
  }

  req.tokenPayload = decoded; // used by /auth/refresh to keep the original login time
  next();
};

/**
 * "admin" must run AFTER "protect" (needs req.user already set).
 * Blocks the request unless the logged-in user is the admin account.
 */
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    return res.status(403).json({ message: "Admin access required" });
  }
};

module.exports = { protect, admin };
