import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

// Holds the logged-in admin's info + login/logout helpers.
// There is no "register" here - only one admin account exists, created via
// the backend's seed script (backend/seed/seedAdmin.js).
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check for an existing session

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem("adminToken"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });

    if (!data.isAdmin) {
      throw new Error("This account is not an admin account");
    }

    localStorage.setItem("adminToken", data.token);
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("adminToken");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
