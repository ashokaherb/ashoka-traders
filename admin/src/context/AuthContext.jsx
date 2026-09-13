import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";
import { TOKEN_KEY, SESSION_EXPIRED_EVENT, endSession, isTokenExpired, tokenExpiresAt } from "../utils/authToken";

// Holds the logged-in admin's info + login/logout helpers.
// There is no "register" here - only one admin account exists, created via
// the backend's seed script (backend/seed/seedAdmin.js).
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check for an existing session
  // true after the 24h admin session times out - Login.jsx explains why they're back there
  const [sessionExpired, setSessionExpired] = useState(false);
  // When the current session ends (ms since epoch) - drives SessionTimeoutWarning.jsx
  const [expiresAt, setExpiresAt] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    if (isTokenExpired(token)) {
      localStorage.removeItem(TOKEN_KEY);
      setSessionExpired(true);
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then((res) => {
        // Only if the session wasn't ended while this request was in flight
        if (localStorage.getItem(TOKEN_KEY) !== token) return;
        setUser(res.data);
        setExpiresAt(tokenExpiresAt(token));
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  // The axios layer ends the session when the server says the token is no longer valid
  useEffect(() => {
    const onExpired = (event) => {
      setUser(null);
      setExpiresAt(null);
      if (event.detail?.expired) setSessionExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // End the session right when the token expires, even if the admin isn't clicking
  // anything - otherwise the panel looks logged in until the next save fails.
  useEffect(() => {
    if (!user || !expiresAt) return;
    // Clamped: setTimeout fires immediately for delays over ~24.8 days (only matters if
    // JWT_ADMIN_EXPIRES_IN is ever raised that high - the default is 24h)
    const delay = Math.min(Math.max(expiresAt - Date.now(), 0), 2 ** 31 - 1);
    const timer = setTimeout(() => endSession({ expired: true }), delay);
    return () => clearTimeout(timer);
  }, [user, expiresAt]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });

    if (!data.isAdmin) {
      throw new Error("This account is not an admin account");
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    setSessionExpired(false);
    setExpiresAt(tokenExpiresAt(data.token));
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setExpiresAt(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, sessionExpired, expiresAt }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
