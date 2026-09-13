/**
 * Wraps an async route handler so a rejected promise is forwarded to Express's
 * error middleware instead of becoming an unhandled rejection.
 *
 * Express 4 only catches errors thrown SYNCHRONOUSLY. An async handler that
 * rejects (a bad ObjectId, a failed DB call, a malformed query) resolves to a
 * rejected promise Express never sees - which Node 20 treats as a fatal
 * unhandled rejection and kills the whole process. One malformed URL was enough
 * to take the entire API down; this wrapper is what stops that.
 *
 * Usage in route files:
 *   router.get("/:id", asyncHandler(getProductById));
 *   router.post("/", protect, admin, asyncHandler(createProduct));
 *
 * Handlers that already have their own try/catch are wrapped too - harmless, and
 * it means no handler is left depending on someone remembering.
 */
const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

module.exports = asyncHandler;
