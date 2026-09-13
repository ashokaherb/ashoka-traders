import axios from "axios";
import { TOKEN_KEY, endSession, isTokenExpired } from "../utils/authToken";

// Central axios instance so every admin page talks to the API the same way.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

// A 401 from the login form means "wrong password", not "session expired"
const isLoginRequest = (config) => /\/auth\/login$/.test(config.url || "");

// Attach the admin's JWT (if we have one saved) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return config;

  if (isTokenExpired(token)) {
    // Don't send a request we know will be rejected - go to the login screen instead
    endSession({ expired: true });
    return config;
  }

  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the server rejects the token anyway, end the session cleanly (PrivateRoute then sends
// the admin to /login and brings them back to this page after logging in).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response, config } = error;
    if (response?.status === 401 && config?.headers?.Authorization && !isLoginRequest(config)) {
      endSession({ expired: response.data?.code === "SESSION_EXPIRED" });
    }
    return Promise.reject(error);
  }
);

export default api;
