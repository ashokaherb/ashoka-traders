import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyForm = {
  storeName: "",
  freeShippingThreshold: 0,
  flatShippingFee: 0,
  minimumOrderValue: 0,
  gstNumber: "",
  supportEmail: "",
  supportPhone: "",
};

// Editor for the single Settings document (created automatically on first save if
// it doesn't exist yet - see backend/controllers/settingsController.js).
export default function SettingsPage() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/settings")
      .then((res) => {
        const s = res.data;
        setForm({
          storeName: s.storeName || "",
          freeShippingThreshold: s.freeShippingThreshold ?? 0,
          flatShippingFee: s.flatShippingFee ?? 0,
          minimumOrderValue: s.minimumOrderValue ?? 0,
          gstNumber: s.gstNumber || "",
          supportEmail: s.supportEmail || "",
          supportPhone: s.supportPhone || "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const payload = {
      ...form,
      freeShippingThreshold: Number(form.freeShippingThreshold),
      flatShippingFee: Number(form.flatShippingFee),
      minimumOrderValue: Number(form.minimumOrderValue),
    };

    try {
      await api.put("/settings", payload);
      setMessage("Settings saved");
    } catch (err) {
      setError(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <p className="text-center mt-10 text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-800 mb-4">Store Settings</h1>

        {message && <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 p-2 rounded">{message}</p>}
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
            <input
              name="storeName"
              value={form.storeName}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Free Shipping Threshold (₹)
              </label>
              <input
                type="number"
                name="freeShippingThreshold"
                value={form.freeShippingThreshold}
                onChange={handleChange}
                min="0"
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-400 mt-1">Orders at/above this subtotal ship free.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Flat Shipping Fee (₹)</label>
              <input
                type="number"
                name="flatShippingFee"
                value={form.flatShippingFee}
                onChange={handleChange}
                min="0"
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-400 mt-1">Charged below the threshold above.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Order Value (₹)</label>
            <input
              type="number"
              name="minimumOrderValue"
              value={form.minimumOrderValue}
              onChange={handleChange}
              min="0"
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-400 mt-1">
              Customers can't check out below this subtotal. Leave at 0 to not enforce a minimum.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GST Number (optional)
            </label>
            <input
              name="gstNumber"
              value={form.gstNumber}
              onChange={handleChange}
              placeholder="e.g. 22AAAAA0000A1Z5"
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-400 mt-1">
              If set, order invoices are generated as GST "Tax Invoice"s. Leave blank for a plain receipt instead.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
              <input
                type="email"
                name="supportEmail"
                value={form.supportEmail}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Support Phone</label>
              <input
                name="supportPhone"
                value={form.supportPhone}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-gray-900 text-white rounded py-2.5 hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
