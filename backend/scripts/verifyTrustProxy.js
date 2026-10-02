#!/usr/bin/env node
/**
 * Checks that TRUST_PROXY is right for the host the backend runs on.
 *
 *   npm run verify:trust-proxy -- https://ashoka-traders.onrender.com
 *
 * Why it matters: rate limits (login, register, coupon, contact) key on req.ip.
 *   Set too LOW  - everyone looks like the proxy's IP, so one attacker's failed logins
 *                  lock out every customer.
 *   Set too HIGH - a visitor can put a fake IP in X-Forwarded-For and dodge the limits.
 *
 * The server must be started with DEBUG_IP_ENDPOINT=true for this check (it exposes
 * /api/debug/ip); remove that variable again afterwards.
 */
const BASE = (process.argv[2] || "http://localhost:5000").replace(/\/$/, "");
const SPOOF = "203.0.113.9"; // TEST-NET-3: never a real client

const get = async (headers = {}) => {
  const res = await fetch(`${BASE}/api/debug/ip`, { headers });
  if (res.status === 404) {
    throw new Error("/api/debug/ip is not available - restart the server with DEBUG_IP_ENDPOINT=true");
  }
  if (!res.ok) throw new Error(`${res.status} from ${BASE}/api/debug/ip`);
  return res.json();
};

(async () => {
  console.log(`Checking ${BASE}\n`);

  const plain = await get();
  console.log(`trust proxy setting : ${plain.trustProxy}`);
  console.log(`your IP as seen     : ${plain.ip}`);
  console.log(`X-Forwarded-For     : ${plain.xForwardedFor || "(none)"}`);

  const spoofed = await get({ "X-Forwarded-For": SPOOF });
  console.log(`\nWith a faked X-Forwarded-For (${SPOOF}):`);
  console.log(`  server sees       : ${spoofed.ip}`);

  const problems = [];
  if (spoofed.ip === SPOOF) {
    problems.push(
      "The faked header was trusted. TRUST_PROXY is too high for this host - a visitor could " +
        "forge their IP and bypass every rate limit. Lower it by one and re-run."
    );
  }
  if (!plain.xForwardedFor && plain.trustProxy > 0) {
    problems.push(
      "No X-Forwarded-For arrived, yet TRUST_PROXY is above 0. If this host has no proxy in " +
        "front of it, set TRUST_PROXY=0."
    );
  }
  if (plain.xForwardedFor && plain.trustProxy === 0) {
    problems.push(
      "A proxy is adding X-Forwarded-For but TRUST_PROXY is 0, so every visitor looks like the " +
        "proxy. One person's failed logins would rate-limit everyone. Set TRUST_PROXY=1."
    );
  }

  if (problems.length) {
    console.error("\nFAIL:\n  - " + problems.join("\n  - "));
    process.exit(1);
  }
  console.log("\nPASS: real visitor IPs are used, and a forged X-Forwarded-For is ignored.");
  console.log("Remember to remove DEBUG_IP_ENDPOINT from the environment now.");
})().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
