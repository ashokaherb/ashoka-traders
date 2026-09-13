import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Security headers for the LIVE storefront (audit M13).
 *
 * The backend's helmet headers only cover API responses. The pages customers actually load
 * come from Netlify, so their Content-Security-Policy is set here: on every production build
 * this writes `dist/_headers`, which Netlify applies to every page it serves.
 *
 * The CSP is an allowlist of where the page may load code/images/connections from. If an
 * attacker ever managed to inject a <script> (XSS), the browser refuses to run it or send
 * data to an unlisted server - which is what protects the login token in localStorage.
 *
 * ADDING A NEW THIRD-PARTY SERVICE? (a chat widget, another analytics tool, images from a
 * new host...) - add its domain to the matching list below, or the browser will block it.
 * Blocked items show as "Refused to load ... Content Security Policy" in the browser console.
 */
function buildCsp(apiOrigin) {
  const directives = {
    "default-src": ["'self'"],
    // Razorpay checkout script + the fraud/risk-detection script it loads from cdn.razorpay.com
    // (found by testing the real popup - blocking it risks declined/flagged live payments),
    // Google Analytics (GoogleAnalytics.jsx)
    "script-src": ["'self'", "https://checkout.razorpay.com", "https://cdn.razorpay.com", "https://www.googletagmanager.com"],
    // 'unsafe-inline' for styles only: React style={{...}} props and Razorpay's popup inject
    // inline styles. Inline SCRIPTS stay blocked, which is what matters for XSS.
    "style-src": ["'self'", "'unsafe-inline'"],
    // Product/category/banner images (Cloudinary), placeholder images, GA tracking pixels
    "img-src": ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://placehold.co", "https://*.google-analytics.com", "https://*.googletagmanager.com"],
    "font-src": ["'self'", "data:"],
    // Our API, Razorpay's checkout telemetry, Google Analytics
    "connect-src": ["'self'", apiOrigin, "https://*.razorpay.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com"],
    // Razorpay's payment popup is an iframe served from its own domain
    "frame-src": ["https://api.razorpay.com", "https://checkout.razorpay.com"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"], // nobody may embed the shop in a frame (clickjacking)
  };
  const policy = Object.entries(directives).map(([name, sources]) => `${name} ${[...new Set(sources)].join(" ")}`);
  // Only upgrade http:// requests when the API itself is on https (always true in production)
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
        "  Referrer-Policy: strict-origin-when-cross-origin",
        "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
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
      port: 5173, // customer storefront runs here
    },
  };
});
