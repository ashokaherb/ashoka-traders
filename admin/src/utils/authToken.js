/**
 * Small helpers for reading the admin login token (a JWT) on the client.
 * (The storefront has its own copy in storefront/src/utils/authToken.js - the two apps
 * are built separately and don't share code.)
 *
 * We only DECODE the token here - to know when it expires - never verify it. The server
 * verifies it on every request (backend/middleware/auth.js).
 *
 * Admin tokens last 24h and can't be refreshed (backend/utils/generateToken.js), so the
 * admin panel's job is just to warn before the session ends and handle it cleanly after.
 */
export const TOKEN_KEY = "adminToken";
export const SESSION_EXPIRED_EVENT = "admin-auth:session-expired";

/** Milliseconds since epoch when the token expires, or 0 if unreadable (treated as expired). */
export function tokenExpiresAt(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export const isTokenExpired = (token) => Date.now() >= tokenExpiresAt(token);

/**
 * Forget the saved token and tell the app. `expired: true` means the session timed out
 * (show "please log in again"); false means it was just invalid, so log out quietly.
 */
export function endSession({ expired }) {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { expired } }));
}
