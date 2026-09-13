/**
 * Security headers for the LIVE storefront (audit M13) - the single source of truth.
 *
 * Delivered by Vercel via `vercel.json`. That file is GENERATED from this one:
 *
 *     npm run vercel:config -- https://your-backend.onrender.com/api
 *
 * and committed. Vercel reads vercel.json before building, so it can't be generated
 * during the deploy itself. To stop the committed file going stale, every Vercel build
 * checks it still matches this file + that deployment's VITE_API_URL, and fails with
 * instructions if not (see vite.config.js) - a stale CSP would silently block every API
 * call and break the whole site.
 *
 * The backend's helmet headers only cover API responses; these cover the pages customers
 * actually load. The CSP is an allowlist of where the page may load code/images/connections
 * from. If an attacker ever injected a <script> (XSS), the browser refuses to run it or send
 * data to an unlisted server - which is what protects the login token in localStorage.
 *
 * ADDING A NEW THIRD-PARTY SERVICE? (a chat widget, another analytics tool, images from a
 * new host...) - add its domain to the matching list below, re-run `npm run vercel:config`,
 * and commit vercel.json. Otherwise the browser blocks it, showing "Refused to load ...
 * Content Security Policy" in the console.
 */
export function buildCsp(apiOrigin) {
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

/** Every response header the site sends, as [name, value] pairs. */
export function securityHeaders(apiOrigin) {
  return [
    ["Content-Security-Policy", buildCsp(apiOrigin)],
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
  ];
}

/** The complete vercel.json for this app, built from the API URL (e.g. https://x.onrender.com/api). */
export function buildVercelConfig(apiUrl) {
  const apiOrigin = new URL(apiUrl).origin;
  return {
    $schema: "https://openapi.vercel.sh/vercel.json",
    headers: [
      {
        source: "/(.*)", // every path: pages, JS/CSS assets, images
        headers: securityHeaders(apiOrigin).map(([key, value]) => ({ key, value })),
      },
    ],
    // React Router handles URLs in the browser - send deep links like /product/basmati-rice
    // to index.html instead of a 404. Real files (JS, CSS, images) are served first.
    rewrites: [{ source: "/(.*)", destination: "/index.html" }],
  };
}
