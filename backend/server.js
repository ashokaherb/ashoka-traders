require("dotenv").config();
const connectDB = require("./config/db");
const { NODE_ENV, checkProductionConfig } = require("./config/env");
const { verifyEmailSetup } = require("./utils/sendEmail");

// In production, stop here if a setting would be insecure (e.g. placeholder JWT_SECRET)
checkProductionConfig();

// Connect to MongoDB before anything else
connectDB();

const app = require("./app");

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (${NODE_ENV} mode)`);
  verifyEmailSetup(); // logs "[EMAIL] SMTP login OK" or the exact reason it fails
});

// --- Last-resort process guards (defence in depth) ---
// asyncHandler should mean nothing reaches these. They exist so that if something
// ever slips past it (a stray .then() with no .catch(), a background timer, a driver
// event), the shop stays up instead of the whole process dying mid-request.
//
// Anything logged here is a BUG to fix at its source, not something to leave running -
// check the server logs for these after deploying.
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION (server kept alive - fix the source):", reason);
});

// NOTE: after an uncaughtException the process is, strictly speaking, in an unknown
// state - Node's own guidance is to log and restart. We keep it alive deliberately:
// for a single-instance shop, staying up with one failed request beats every customer
// getting a connection error. If you later run under a process manager that restarts
// cleanly (PM2, Render), consider exiting here instead.
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION (server kept alive - fix the source):", error);
});
