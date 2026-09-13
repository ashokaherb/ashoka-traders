const { isProduction } = require("../config/env");

/**
 * Central Express error handler.
 *
 * Receives everything passed to next(err), including async rejections forwarded by
 * middleware/asyncHandler.js. Mongoose's own error types are translated into sensible
 * status codes with a clean message, so a bad ObjectId in a URL returns 400 instead of
 * a 500 full of driver internals (or, before asyncHandler existed, killing the process).
 *
 * Production vs development (audit finding M12):
 *   - The FULL error (message + stack) is always logged on the server.
 *   - 4xx errors are the client's own mistake with a message written for them
 *     ("Insufficient stock...", "Invalid coupon") - those are returned in both modes.
 *   - 5xx errors are our bugs or infrastructure failures. Their message can contain
 *     database, file-path or third-party internals, so in production the client only
 *     gets "Something went wrong". In development the message + stack are returned
 *     to make debugging easier.
 *
 * Mounted last in server.js, after the 404 handler.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity (4 args)
const errorHandler = (err, req, res, next) => {
  console.error(`[${req.method} ${req.originalUrl}]`, err.stack || err);

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
  // Malformed JSON body - express.json() sets status 400 on these
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body is not valid JSON" });
  }

  // Razorpay SDK failures look like { statusCode, error: { code, description } }. Their
  // statusCode is RAZORPAY's answer to OUR server (e.g. 401 = our API keys are wrong), not
  // the customer's fault - passing a 401 through would make the storefront think the
  // customer's own login expired and log them out. Report it as a gateway failure instead.
  if (err.error?.code && err.statusCode) {
    return res.status(502).json({ message: "The payment service is unavailable right now. Please try again shortly." });
  }

  const rawStatus = Number(err.status || err.statusCode);
  const status = rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;

  if (status < 500) {
    // Deliberate client-facing error (e.g. OrderValidationError) - safe to show in any mode
    return res.status(status).json({ message: err.message || "Request could not be processed" });
  }

  if (isProduction) {
    return res.status(status).json({ message: "Something went wrong. Please try again later." });
  }
  return res.status(status).json({ message: err.message || "Server error", stack: err.stack });
};

module.exports = errorHandler;
