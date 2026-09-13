import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Wraps a page that should only be reachable by a logged-in admin.
// Usage: <Route path="/" element={<PrivateRoute><ProductList /></PrivateRoute>} />
export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="text-center mt-10 text-gray-500">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
