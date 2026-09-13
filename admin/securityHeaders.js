/**
 * Security headers for the LIVE admin panel (audit M13) - the single source of truth.
 * Same setup as storefront/securityHeaders.js (the two apps are built and deployed
 * separately, so each has its own copy):
 *
 *     npm run vercel:config -- https://your-backend.onrender.com/api
 *
 * writes `vercel.json` from this file; commit it. Every Vercel build checks the committed
 * file still matches (see vite.config.js) and fails with instructions if it has gone stale.
 *
 * The admin panel loads far less than the storefront (no payments, no analytics), so its
 * allowlist is shorter - a stricter policy for the app with the most powerful login.
 *
 * ADDING A NEW THIRD-PARTY SERVICE? Add its domain below, re-run `npm run vercel:config`,
 * and commit vercel.json - or the browser will block it.
 */
export function buildCsp(apiOrigin) {
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

/** Every response header the admin panel sends, as [name, value] pairs. */
export function securityHeaders(apiOrigin) {
  return [
    ["Content-Security-Policy", buildCsp(apiOrigin)],
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", "same-origin"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
    ["X-Robots-Tag", "noindex"], // keep the admin panel out of search engines
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
    // React Router handles URLs in the browser - send deep links like /orders/123 to
    // index.html instead of a 404. Real files (JS, CSS, images) are served first.
    rewrites: [{ source: "/(.*)", destination: "/index.html" }],
  };
}
