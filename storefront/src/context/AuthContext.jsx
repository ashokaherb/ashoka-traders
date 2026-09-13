import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

// Holds the logged-in customer's info + login/register/logout helpers,
// available anywhere in the app via useAuth().
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check for an existing session

  // On first load, if a token is saved, fetch the current user so a page refresh
  // doesn't log the customer out.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("token"); // token expired/invalid
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    setUser(data);
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
    localStorage.setItem("token", data.token);
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  // Lets a page (e.g. Profile) push freshly-saved fields into the shared user object
  // immediately, without waiting for a page reload / the next /auth/me fetch.
  const updateUser = (data) => setUser((prev) => ({ ...prev, ...data }));

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Convenience hook: const { user, login, logout } = useAuth();
export const useAuth = () => useContext(AuthContext);
