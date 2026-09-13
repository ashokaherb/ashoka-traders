import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyForm = {
  storeName: "",
  freeShippingThreshold: 0,
  flatShippingFee: 0,
  minimumOrderValue: 0,
  gstNumber: "",
  gstScheme: "not_registered",
  gstRate: 5,
  storeState: "",
  storeAddress: "",
  panNumber: "",
  invoiceTerms: "",
  supportEmail: "",
  supportPhone: "",
};

// What each GST scheme means, shown next to the dropdown so the right one gets picked.
const GST_SCHEME_OPTIONS = {
  composition: {
    label: "Composition",
    help: 'GST-registered under the Composition Scheme. Orders get a "Bill of Supply" with your GSTIN and no tax shown - you cannot charge GST separately.',
  },
  regular: {
    label: "Regular",
    help: 'Normal GST registration. Orders get a "Tax Invoice" showing CGST/SGST or IGST for each item.',
  },
  not_registered: {
    label: "Not Registered",
    help: "No GST registration. Orders get a plain receipt with no GST details.",
  },
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
          gstScheme: s.gstScheme || "not_registered",
          gstRate: s.gstRate ?? 5,
          storeState: s.storeState || "",
          storeAddress: s.storeAddress || "",
          panNumber: s.panNumber || "",
          invoiceTerms: s.invoiceTerms || "",
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
      gstRate: Number(form.gstRate),
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

          {/* GST registration - decides whether orders get a Bill of Supply, Tax Invoice or
              plain receipt (backend/utils/invoiceType.js). */}
          <fieldset className="border rounded p-4 flex flex-col gap-4">
            <legend className="px-1 text-sm font-semibold text-gray-800">GST Registration</legend>

            <div>
              <label htmlFor="gstScheme" className="block text-sm font-medium text-gray-700 mb-1">
                GST Scheme
              </label>
              <select
                id="gstScheme"
                name="gstScheme"
                value={form.gstScheme}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2 bg-white"
              >
                {Object.entries(GST_SCHEME_OPTIONS).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ul className="mt-2 text-xs text-gray-500 flex flex-col gap-1">
                {Object.entries(GST_SCHEME_OPTIONS).map(([value, { label, help }]) => (
                  <li key={value} className={value === form.gstScheme ? "text-gray-900 font-medium" : ""}>
                    <span className="font-semibold">{label}:</span> {help}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-700">
                Not sure? Your GST registration certificate (or your CA) tells you which scheme you're under.
              </p>
            </div>

            {form.gstScheme !== "not_registered" && (
              <div>
                <label htmlFor="gstNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  GSTIN
                </label>
                <input
                  id="gstNumber"
                  name="gstNumber"
                  value={form.gstNumber}
                  onChange={handleChange}
                  required
                  maxLength={15}
                  placeholder="15-character GSTIN, e.g. 05ABCDE1234F1Z5"
                  className="w-full border rounded px-3 py-2 uppercase"
                />
                <p className="text-xs text-gray-400 mt-1">Printed on every bill/invoice.</p>
              </div>
            )}

            {form.gstScheme === "regular" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="gstRate" className="block text-sm font-medium text-gray-700 mb-1">
                    GST Rate included in prices (%)
                  </label>
                  <input
                    id="gstRate"
                    type="number"
                    name="gstRate"
                    value={form.gstRate}
                    onChange={handleChange}
                    min="0"
                    max="40"
                    step="0.01"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="storeState" className="block text-sm font-medium text-gray-700 mb-1">
                    Store State
                  </label>
                  <input
                    id="storeState"
                    name="storeState"
                    value={form.storeState}
                    onChange={handleChange}
                    placeholder="e.g. Uttarakhand"
                    className="w-full border rounded px-3 py-2"
                  />
                  <p className="text-xs text-gray-400 mt-1">Same-state orders: CGST + SGST. Others: IGST.</p>
                </div>
              </div>
            )}
          </fieldset>

          {/* Details printed on customer bills - see backend/utils/generateInvoicePDF.js */}
          <fieldset className="border rounded p-4 flex flex-col gap-4">
            <legend className="px-1 text-sm font-semibold text-gray-800">Bill Details</legend>
            <div>
              <label htmlFor="storeAddress" className="block text-sm font-medium text-gray-700 mb-1">
                Store Address
              </label>
              <textarea
                id="storeAddress"
                name="storeAddress"
                value={form.storeAddress}
                onChange={handleChange}
                rows={2}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="panNumber" className="block text-sm font-medium text-gray-700 mb-1">
                PAN <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="panNumber"
                name="panNumber"
                value={form.panNumber}
                onChange={handleChange}
                maxLength={10}
                placeholder="e.g. ABCDE1234F"
                className="w-full border rounded px-3 py-2 uppercase placeholder:normal-case"
              />
            </div>
            <div>
              <label htmlFor="invoiceTerms" className="block text-sm font-medium text-gray-700 mb-1">
                Terms &amp; Conditions on bills
              </label>
              <textarea
                id="invoiceTerms"
                name="invoiceTerms"
                value={form.invoiceTerms}
                onChange={handleChange}
                rows={3}
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                One term per line. Keep it to 2-3 short lines so the bill stays one page.
              </p>
            </div>
          </fieldset>

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
