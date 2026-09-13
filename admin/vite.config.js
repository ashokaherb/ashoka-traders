import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Security headers for the LIVE admin panel (audit M13). Same idea as
 * storefront/vite.config.js: every production build writes `dist/_headers`, which Netlify
 * applies to every page. The admin panel loads far less than the storefront (no payments,
 * no analytics), so its allowlist is shorter - which also means a stricter policy for the
 * app with the most powerful login.
 *
 * ADDING A NEW THIRD-PARTY SERVICE? Add its domain to the matching list below, or the
 * browser will block it ("Refused to load ... Content Security Policy" in the console).
 */
function buildCsp(apiOrigin) {
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'", "'unsafe-inline'"], // React style={{...}} props; inline SCRIPTS stay blocked
    // Cloudinary images, placeholders, and blob: for image previews before upload
    "img-src": ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://placehold.co"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", apiOrigin], // uploads go through our API, not straight to Cloudinary
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, sources]) => `${name} ${[...new Set(sources)].join(" ")}`);
  if (apiOrigin.startsWith("https://")) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

const netlifyHeaders = (apiOrigin) => ({
  name: "netlify-security-headers",
  apply: "build", // the dev server doesn't get a CSP - Vite's hot reload uses inline scripts
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "_headers",
      source: [
        "/*",
        `  Content-Security-Policy: ${buildCsp(apiOrigin)}`,
        "  X-Content-Type-Options: nosniff",
        "  X-Frame-Options: DENY",
        "  Referrer-Policy: same-origin",
        "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
        "  X-Robots-Tag: noindex", // keep the admin panel out of search engines
        "",
      ].join("\n"),
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiOrigin = new URL(env.VITE_API_URL || "http://localhost:5000/api").origin;

  return {
    plugins: [react(), netlifyHeaders(apiOrigin)],
    server: {
      port: 5174, // admin panel runs here (storefront uses 5173)
    },
  };
});
