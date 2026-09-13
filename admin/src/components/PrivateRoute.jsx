import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Wraps a page that should only be reachable by a logged-in admin.
// Usage: <Route path="/" element={<PrivateRoute><ProductList /></PrivateRoute>} />
export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="text-center mt-10 text-gray-500">Loading...</p>;

  // Remember where the admin was, so after logging in again (e.g. when the 24h session
  // ends) Login.jsx can bring them straight back instead of to the dashboard.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  return children;
}
