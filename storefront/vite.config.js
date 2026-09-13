import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { buildVercelConfig } from "./securityHeaders.js";

/**
 * Deploy guard for the live site's security headers (audit M13).
 *
 * The CSP is delivered by the committed vercel.json, generated from securityHeaders.js.
 * On Vercel (which sets VERCEL=1 during builds), this stops the deploy if vercel.json
 * doesn't match what securityHeaders.js + this deployment's VITE_API_URL would produce -
 * e.g. the backend URL changed but vercel.json wasn't regenerated. Shipping that would make
 * the browser block every API call. Local builds skip the check (they use localhost).
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
          `site would block its own API calls. Fix it locally, commit, and redeploy:\n\n` +
          `    cd storefront && npm run vercel:config -- ${apiUrl}\n`
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
      port: 5173, // customer storefront runs here
    },
  };
});
