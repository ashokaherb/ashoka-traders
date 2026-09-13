import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Set by PrivateRoute / SessionTimeoutWarning - the page to return to after logging in
  const returnTo = location.state?.from || "/";

  // Always starts empty. No default or remembered credentials live in this code; the
  // autoComplete hints below only let the browser's own password manager offer what
  // the admin has chosen to save there.
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-sm w-full bg-white p-6 rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold mb-1 text-gray-800">Admin Login</h1>
        <p className="text-sm text-gray-500 mb-4">Ashoka Traders management panel</p>

        {sessionExpired && !error && (
          <p className="mb-4 text-sm text-amber-900 bg-amber-50 p-2 rounded">
            Your admin session ended - for security, admin logins last 24 hours. Please log in again.
          </p>
        )}

        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            name="email"
            placeholder="Admin email"
            autoComplete="username"
            value={form.email}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-gray-900 text-white rounded py-2 hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
