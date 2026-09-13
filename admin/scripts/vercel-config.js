/**
 * Writes this app's vercel.json from securityHeaders.js.
 *
 *   npm run vercel:config -- https://your-backend.onrender.com/api
 *
 * Pass the SAME value you set as VITE_API_URL in the Vercel project, then commit vercel.json.
 * Re-run it whenever the backend URL changes (e.g. you attach api.yourdomain.com) or you
 * edit securityHeaders.js - the Vercel build refuses to deploy a vercel.json that has
 * gone out of date (see vite.config.js).
 */
import { writeFileSync } from "node:fs";
import { buildVercelConfig } from "../securityHeaders.js";

const args = process.argv.slice(2);
const allowHttp = args.includes("--allow-http"); // only for local testing, never commit the result
const apiUrl = args.find((a) => !a.startsWith("--")) || process.env.VITE_API_URL;

const fail = (msg) => {
  console.error(`\n${msg}\n\nUsage: npm run vercel:config -- https://your-backend.onrender.com/api\n`);
  process.exit(1);
};

if (!apiUrl) fail("Missing the backend API URL.");
let parsed;
try {
  parsed = new URL(apiUrl);
} catch {
  fail(`"${apiUrl}" is not a valid URL.`);
}
if (parsed.protocol !== "https:" && !allowHttp) {
  fail(`"${apiUrl}" is not https - the live site's API must use HTTPS.`);
}

const outFile = new URL("../vercel.json", import.meta.url);
writeFileSync(outFile, JSON.stringify(buildVercelConfig(apiUrl), null, 2) + "\n");
console.log(`Wrote vercel.json with connect-src allowing ${parsed.origin}`);
console.log("Commit it, and make sure VITE_API_URL in the Vercel project is the same URL.");
