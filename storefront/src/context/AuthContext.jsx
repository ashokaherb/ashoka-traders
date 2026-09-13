import { createContext, useContext, useEffect, useState } from "react";
import api, { refreshSession } from "../api/axios";
import {
  TOKEN_KEY,
  SESSION_EXPIRED_EVENT,
  TOKEN_REFRESHED_EVENT,
  endSession,
  isTokenExpired,
  tokenExpiresAt,
  tokenHalfLifeAt,
} from "../utils/authToken";

// Holds the logged-in customer's info + login/register/logout helpers,
// available anywhere in the app via useAuth().
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check for an existing session
  // true after a session times out - drives the "please log in again" notice (SessionExpiredNotice.jsx)
  const [sessionExpired, setSessionExpired] = useState(false);
  // Bumped whenever the saved token changes, so the timers below re-schedule
  const [tokenVersion, setTokenVersion] = useState(0);

  // On first load, if a token is saved, fetch the current user so a page refresh
  // doesn't log the customer out.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    if (isTokenExpired(token)) {
      // Came back after the session ran out - say so, rather than silently showing "Log in"
      localStorage.removeItem(TOKEN_KEY);
      setSessionExpired(true);
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then((res) => {
        // The session can end WHILE this request is in flight - e.g. the silent refresh it
        // triggered came back "past the 30-day limit" and logged the customer out. Don't let
        // this late reply log them back in on screen with no token behind it.
        if (localStorage.getItem(TOKEN_KEY)) setUser(res.data);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY); // token invalid (the axios interceptor handles the notice)
      })
      .finally(() => setLoading(false));
  }, []);

  // Listen for the axios layer ending or refreshing the session (see api/axios.js)
  useEffect(() => {
    const onExpired = (event) => {
      setUser(null);
      if (event.detail?.expired) setSessionExpired(true);
    };
    const onRefreshed = () => setTokenVersion((v) => v + 1);

    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener(TOKEN_REFRESHED_EVENT, onRefreshed);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener(TOKEN_REFRESHED_EVENT, onRefreshed);
    };
  }, []);

  // Timers for a tab left open without clicking anything (no API calls = no interceptor):
  //  - at half-life, refresh silently so an open tab stays logged in
  //  - at expiry, log out with the "session expired" notice instead of a stale logged-in look
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!user || !token) return;

    const now = Date.now();
    // setTimeout can't wait longer than ~24.8 days; our tokens are far shorter, but clamp anyway
    const MAX_DELAY = 2 ** 31 - 1;
    const refreshTimer = setTimeout(refreshSession, Math.min(Math.max(tokenHalfLifeAt(token) - now, 0), MAX_DELAY));
    const expiryTimer = setTimeout(() => endSession({ expired: true }), Math.min(Math.max(tokenExpiresAt(token) - now, 0), MAX_DELAY));

    return () => {
      clearTimeout(refreshTimer);
      clearTimeout(expiryTimer);
    };
  }, [user, tokenVersion]);

  const startSession = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setSessionExpired(false);
    setTokenVersion((v) => v + 1);
    setUser(data);
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    startSession(data);
    return data;
  };

  const register = async (name, email, password, phone, whatsappOptIn, whatsappNumber) => {
    const { data } = await api.post("/auth/register", {
      name,
      email,
      password,
      phone,
      whatsappOptIn,
      whatsappNumber,
    });
    startSession(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  // Lets a page (e.g. Profile) push freshly-saved fields into the shared user object
  // immediately, without waiting for a page reload / the next /auth/me fetch.
  const updateUser = (data) => setUser((prev) => ({ ...prev, ...data }));

  const dismissSessionExpired = () => setSessionExpired(false);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, updateUser, sessionExpired, dismissSessionExpired }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Convenience hook: const { user, login, logout } = useAuth();
export const useAuth = () => useContext(AuthContext);
