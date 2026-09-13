import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { buildVercelConfig } from "./securityHeaders.js";

/**
 * Deploy guard for the live admin panel's security headers (audit M13) - same as
 * storefront/vite.config.js. On Vercel (VERCEL=1), the build fails if the committed
 * vercel.json doesn't match securityHeaders.js + this deployment's VITE_API_URL, because a
 * stale CSP would block every API call. Local builds skip the check.
 */
const vercelConfigGuard = (apiUrl) => ({
  name: "vercel-config-guard",
  apply: "build",
  buildStart() {
    if (!process.env.VERCEL) return;
    if (!apiUrl) {
      this.error("VITE_API_URL is not set in this Vercel project's Environment Variables.");
    }

    let committed;
    try {
      committed = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8"));
    } catch {
      this.error("vercel.json is missing or not valid JSON.");
    }
    const expected = buildVercelConfig(apiUrl);
    if (JSON.stringify(committed) !== JSON.stringify(expected)) {
      this.error(
        `vercel.json is out of date for VITE_API_URL=${apiUrl}.\n` +
          `Its security headers don't match securityHeaders.js for this backend URL, so the live\n` +
          `admin panel would block its own API calls. Fix it locally, commit, and redeploy:\n\n` +
          `    cd admin && npm run vercel:config -- ${apiUrl}\n`
      );
    }
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [react(), vercelConfigGuard(env.VITE_API_URL)],
    server: {
      port: 5174, // admin panel runs here (storefront uses 5173)
    },
  };
});
