const jwt = require("jsonwebtoken");

/**
 * Creates a signed JWT containing the user's Mongo _id.
 * The token is returned to the client and sent back on every
 * request as "Authorization: Bearer <token>" (see middleware/auth.js).
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
};

module.exports = generateToken;
