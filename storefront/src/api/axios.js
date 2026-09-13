import axios from "axios";
import {
  TOKEN_KEY,
  TOKEN_REFRESHED_EVENT,
  endSession,
  isTokenExpired,
  tokenHalfLifeAt,
} from "../utils/authToken";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Central axios instance so every page/component talks to the API the same way.
const api = axios.create({ baseURL });

// Login/register responses are about the credentials typed in, not the saved session -
// a 401 there must not be mistaken for "your session expired".
const isCredentialRequest = (config) => /\/auth\/(login|register)$/.test(config.url || "");

/**
 * Silent refresh: swaps the current token for a fresh one (POST /auth/refresh).
 * "Single flight" - if several requests trigger it at once, they share one call.
 * Uses plain axios, not `api`, so it doesn't loop back through the interceptors below.
 */
let refreshInFlight = null;
let refreshRefusedFor = null; // token the server said can't be refreshed - don't keep asking

export function refreshSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || token === refreshRefusedFor) return Promise.resolve();

  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${baseURL}/auth/refresh`, null, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        localStorage.setItem(TOKEN_KEY, data.token);
        window.dispatchEvent(new Event(TOKEN_REFRESHED_EVENT)); // AuthContext re-schedules its timers
      })
      .catch((err) => {
        const status = err.response?.status;
        if (status === 401) {
          // Past the 30-day limit (or no longer valid) - the customer must log in again
          endSession({ expired: err.response.data?.code === "SESSION_EXPIRED" });
        } else if (status === 403) {
          // e.g. the admin account logged into the storefront - its token can't be extended,
          // it just runs out normally
          refreshRefusedFor = token;
        }
        // Network errors: keep the current token, we'll try again on a later request
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// Attach the JWT (if we have one saved) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return config;

  if (isTokenExpired(token)) {
    // Don't send a request we know will be rejected - log out cleanly instead
    endSession({ expired: true });
    return config;
  }

  config.headers.Authorization = `Bearer ${token}`;

  // Past half its lifetime -> quietly get a new one in the background. This request
  // still goes out with the current (valid) token; it isn't delayed.
  if (Date.now() >= tokenHalfLifeAt(token) && !isCredentialRequest(config)) {
    refreshSession();
  }
  return config;
});

// If the server rejects our token anyway (expired, or the account was deleted), log out
// cleanly instead of leaving pages half-loaded with confusing errors.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response, config } = error;
    if (response?.status === 401 && config?.headers?.Authorization && !isCredentialRequest(config)) {
      endSession({ expired: response.data?.code === "SESSION_EXPIRED" });
    }
    return Promise.reject(error);
  }
);

export default api;
