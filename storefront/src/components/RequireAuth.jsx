import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps a page that requires a logged-in customer (checkout, order success,
 * my orders). If they're not logged in, sends them to /login and remembers
 * where they were headed via ?redirect= so login can continue them there
 * afterwards instead of dropping them back on the Home page.
 */
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="text-center mt-10 text-gray-500">Loading...</p>;

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return children;
}
