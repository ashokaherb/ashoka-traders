/**
 * Small helpers for reading the login token (a JWT) on the client.
 *
 * We only DECODE the token here - to know when it expires - never verify it. Verifying
 * needs the server's secret; the server does that on every request (middleware/auth.js).
 * So nothing here can be used to fake a login, it just lets the UI react before the
 * server has to reject a request.
 */
export const TOKEN_KEY = "token";

// Fired on `window` so the axios module and AuthContext can talk without importing each other
export const SESSION_EXPIRED_EVENT = "auth:session-expired";
export const TOKEN_REFRESHED_EVENT = "auth:token-refreshed";

/** Returns the token's payload ({ id, iat, exp, authTime }) or null if it can't be read. */
export function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    // JWTs use base64url - swap to plain base64 so atob() can read it
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/** Milliseconds since epoch when the token expires, or 0 if unreadable (treated as expired). */
export function tokenExpiresAt(token) {
  const payload = token && decodeToken(token);
  return payload?.exp ? payload.exp * 1000 : 0;
}

export const isTokenExpired = (token) => Date.now() >= tokenExpiresAt(token);

/** When the token is halfway through its life - the point we refresh it silently. */
export function tokenHalfLifeAt(token) {
  const payload = token && decodeToken(token);
  if (!payload?.exp || !payload?.iat) return 0;
  return ((payload.iat + payload.exp) / 2) * 1000;
}

/**
 * Forget the saved token and tell the app. `expired: true` means the session timed out
 * (show "please log in again"); false means it was just invalid, so log out quietly.
 */
export function endSession({ expired }) {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { expired } }));
}
