import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    whatsappOptIn: false,
    whatsappNumber: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(
        form.name,
        form.email,
        form.password,
        form.phone,
        form.whatsappOptIn,
        form.whatsappOptIn ? form.whatsappNumber : ""
      );
      navigate(redirectTo);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded-lg shadow-sm">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Create an account</h1>

      {redirectTo === "/checkout" && (
        <p className="mb-4 text-sm text-brand-700 bg-brand-50 p-2 rounded">
          Create an account to continue to checkout - your cart will be waiting.
        </p>
      )}

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          name="name"
          placeholder="Full name"
          value={form.name}
          onChange={handleChange}
          required
          className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
          className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          name="phone"
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={handleChange}
          className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
          minLength={6}
          className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            name="whatsappOptIn"
            checked={form.whatsappOptIn}
            onChange={handleChange}
          />
          Send me WhatsApp updates about new arrivals and offers
        </label>
        {form.whatsappOptIn && (
          <input
            name="whatsappNumber"
            placeholder="WhatsApp number (with country code, e.g. 91XXXXXXXXXX)"
            value={form.whatsappNumber}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-brand-600 text-white rounded py-2 hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Creating account..." : "Register"}
        </button>
      </form>

      <p className="text-sm text-gray-600 mt-4">
        Already have an account?{" "}
        <Link
          to={`/login?redirect=${encodeURIComponent(redirectTo)}`}
          className="text-brand-700 font-medium"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
