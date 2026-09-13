const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * "protect" checks for a valid JWT in the Authorization header and,
 * if valid, attaches the matching user document to req.user.
 * Use this on any route that requires a logged-in user.
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

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id); // password excluded by schema's select:false
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized, user no longer exists" });
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token invalid or expired" });
  }
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
