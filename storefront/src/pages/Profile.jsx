import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// Logged-in customer's account page. Keeps to what's actually editable here -
// WhatsApp preferences - plus a read-only view of the account basics. The saved
// shipping address is edited at checkout (where it's actually used), not duplicated here.
export default function Profile() {
  const { user, updateUser } = useAuth();
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setWhatsappOptIn(Boolean(user.whatsappOptIn));
      setWhatsappNumber(user.whatsappNumber || "");
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const { data } = await api.put("/auth/whatsapp", {
        whatsappOptIn,
        whatsappNumber: whatsappOptIn ? whatsappNumber : "",
      });
      updateUser(data);
      setMessage("Preferences saved");
    } catch (err) {
      setError(err.response?.data?.message || "Could not save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-800 mb-4">My Profile</h1>

      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <p className="text-sm text-gray-500">Name</p>
        <p className="text-gray-800 mb-3">{user.name}</p>
        <p className="text-sm text-gray-500">Email</p>
        <p className="text-gray-800">{user.email}</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="font-semibold text-gray-700 mb-3">WhatsApp Updates</h2>

        {message && <p className="mb-3 text-sm text-brand-700 bg-brand-50 p-2 rounded">{message}</p>}
        {error && <p className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(e) => setWhatsappOptIn(e.target.checked)}
            />
            Send me WhatsApp updates about new arrivals and offers
          </label>

          {whatsappOptIn && (
            <input
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="WhatsApp number (with country code, e.g. 91XXXXXXXXXX)"
              required
              className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          )}

          {user.whatsappOptIn && user.whatsappOptInDate && (
            <p className="text-xs text-gray-400">
              You opted in on {new Date(user.whatsappOptInDate).toLocaleDateString()}.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-brand-600 text-white rounded py-2 hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </form>
      </div>
    </div>
  );
}
