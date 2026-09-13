/**
 * Central Express error handler.
 *
 * Receives everything passed to next(err), including async rejections forwarded by
 * middleware/asyncHandler.js. Mongoose's own error types are translated into sensible
 * status codes with a clean message, so a bad ObjectId in a URL returns 400 instead of
 * a 500 full of driver internals (or, before asyncHandler existed, killing the process).
 *
 * Mounted last in server.js, after the 404 handler.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity (4 args)
const errorHandler = (err, req, res, next) => {
  console.error(err.stack || err);

  // Bad ObjectId / uncastable query value, e.g. GET /api/products/not-an-id
  if (err.name === "CastError") {
    return res.status(400).json({ message: `Invalid ${err.path || "value"} in request` });
  }
  // Malformed query operators, e.g. ?search[$x]=1 reaching a $text search
  if (err.name === "ObjectParameterError" || err.name === "StrictModeError") {
    return res.status(400).json({ message: "Invalid query parameter" });
  }
  // Schema validation failures - surface which fields, not the raw Mongoose text
  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation failed",
      fields: Object.keys(err.errors || {}),
    });
  }
  // Duplicate key on a unique index (email, slug, coupon code...)
  if (err.code === 11000) {
    return res.status(400).json({ message: "That value is already taken" });
  }
  // Multer upload rejections (file too large, too many files, wrong field name)
  if (err.name === "MulterError") {
    return res.status(400).json({ message: err.message });
  }

  res.status(err.status || err.statusCode || 500).json({ message: err.message || "Server error" });
};

module.exports = errorHandler;
