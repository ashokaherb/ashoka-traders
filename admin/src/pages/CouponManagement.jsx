import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyForm = {
  code: "",
  discountType: "percent",
  value: "",
  expiryDate: "",
  minOrderValue: "",
  usageLimit: "",
  active: true,
};

// "10% OFF" / "₹50 OFF" - same wording the storefront checkout uses.
const describeDiscount = (c) => (c.discountType === "percent" ? `${c.value}% OFF` : `₹${c.value} OFF`);

const isExpired = (c) => c.expiryDate && new Date(c.expiryDate) < new Date();
const isUsedUp = (c) => c.usageLimit != null && c.usedCount >= c.usageLimit;

// Expiry is picked as a date; store it as the END of that day so the coupon still works on it.
const endOfDay = (yyyyMmDd) => (yyyyMmDd ? new Date(`${yyyyMmDd}T23:59:59`).toISOString() : null);
const toDateInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function StatusBadge({ coupon }) {
  const [label, style] = !coupon.active
    ? ["Inactive", "bg-gray-100 text-gray-600"]
    : isExpired(coupon)
      ? ["Expired", "bg-red-50 text-red-700"]
      : isUsedUp(coupon)
        ? ["Used up", "bg-amber-50 text-amber-700"]
        : ["Live", "bg-emerald-50 text-emerald-700"];
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${style}`}>{label}</span>;
}

export default function CouponManagement() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCoupons = () =>
    api
      .get("/coupons")
      .then((res) => setCoupons(res.data))
      .catch((err) => setError(err.response?.data?.message || "Could not load coupons"))
      .finally(() => setLoading(false));

  useEffect(() => {
    loadCoupons();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const next = type === "checkbox" ? checked : name === "code" ? value.toUpperCase().replace(/\s/g, "") : value;
    setForm({ ...form, [name]: next });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    const payload = {
      code: form.code.trim(),
      discountType: form.discountType,
      value: Number(form.value),
      expiryDate: endOfDay(form.expiryDate),
      minOrderValue: form.minOrderValue === "" ? 0 : Number(form.minOrderValue),
      usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit), // blank = unlimited
      active: form.active,
    };

    try {
      if (editingId) {
        await api.put(`/coupons/${editingId}`, payload);
        setMessage(`Coupon ${payload.code} updated`);
      } else {
        await api.post("/coupons", payload);
        setMessage(`Coupon ${payload.code} created`);
      }
      resetForm();
      loadCoupons();
    } catch (err) {
      setError(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (coupon) => {
    setEditingId(coupon._id);
    setMessage("");
    setError("");
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      value: coupon.value,
      expiryDate: toDateInput(coupon.expiryDate),
      minOrderValue: coupon.minOrderValue || "",
      usageLimit: coupon.usageLimit ?? "",
      active: coupon.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (coupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}? Customers won't be able to use it any more.`)) return;
    try {
      await api.delete(`/coupons/${coupon._id}`);
      if (editingId === coupon._id) resetForm();
      loadCoupons();
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed");
    }
  };

  const handleToggleActive = async (coupon) => {
    try {
      await api.put(`/coupons/${coupon._id}`, { active: !coupon.active });
      loadCoupons();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update coupon");
    }
  };

  const isPercent = form.discountType === "percent";

  return (
    <div>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-800 mb-4">Coupons</h1>

        {message && <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 p-2 rounded">{message}</p>}
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

        {/* --- Create / edit form --- */}
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-lg shadow-sm mb-6 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-800">{editingId ? `Edit Coupon ${form.code}` : "Create Coupon"}</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                Coupon Code
              </label>
              <input
                id="code"
                name="code"
                value={form.code}
                onChange={handleChange}
                required
                maxLength={20}
                placeholder="e.g. SAVE10"
                className="w-full border rounded px-3 py-2 uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal"
              />
            </div>

            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-1">Discount Type</legend>
              <div className="flex gap-2">
                {[
                  ["percent", "Percentage %"],
                  ["flat", "Flat Amount (₹)"],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex-1 flex items-center gap-2 border rounded px-3 py-2 text-sm cursor-pointer ${
                      form.discountType === value ? "border-gray-900 bg-gray-50" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="discountType"
                      value={value}
                      checked={form.discountType === value}
                      onChange={handleChange}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="value" className="block text-sm font-medium text-gray-700 mb-1">
                {isPercent ? "Discount Percentage" : "Discount Amount"}
              </label>
              <div className="flex items-stretch border rounded overflow-hidden focus-within:ring-2 focus-within:ring-gray-300">
                {!isPercent && <span className="px-3 flex items-center bg-gray-50 text-gray-500 border-r">₹</span>}
                <input
                  id="value"
                  type="number"
                  name="value"
                  value={form.value}
                  onChange={handleChange}
                  required
                  min="1"
                  max={isPercent ? 100 : undefined}
                  step="any"
                  placeholder={isPercent ? "10" : "50"}
                  className="flex-1 min-w-0 px-3 py-2 outline-none"
                />
                {isPercent && <span className="px-3 flex items-center bg-gray-50 text-gray-500 border-l">%</span>}
              </div>
            </div>

            <div>
              <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Date <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="expiryDate"
                type="date"
                name="expiryDate"
                value={form.expiryDate}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-400 mt-1">Works until the end of this day. Blank = never expires.</p>
            </div>

            <div>
              <label htmlFor="minOrderValue" className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Order Value <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <div className="flex items-stretch border rounded overflow-hidden focus-within:ring-2 focus-within:ring-gray-300">
                <span className="px-3 flex items-center bg-gray-50 text-gray-500 border-r">₹</span>
                <input
                  id="minOrderValue"
                  type="number"
                  name="minOrderValue"
                  value={form.minOrderValue}
                  onChange={handleChange}
                  min="0"
                  step="any"
                  placeholder="0"
                  className="flex-1 min-w-0 px-3 py-2 outline-none"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Cart subtotal needed to use it. Blank = no minimum.</p>
            </div>

            <div>
              <label htmlFor="usageLimit" className="block text-sm font-medium text-gray-700 mb-1">
                Usage Limit <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="usageLimit"
                type="number"
                name="usageLimit"
                value={form.usageLimit}
                onChange={handleChange}
                min="1"
                step="1"
                placeholder="Unlimited"
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-400 mt-1">Total uses across all customers. Blank = unlimited.</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" checked={form.active} onChange={handleChange} />
            Active <span className="text-gray-400">(customers can use it right away)</span>
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-gray-900 text-white rounded px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Update Coupon" : "Create Coupon"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 text-gray-700 rounded px-4 py-2 hover:bg-gray-300"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* --- Existing coupons --- */}
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Discount</th>
                <th className="px-4 py-2">Min. Order</th>
                <th className="px-4 py-2">Expiry</th>
                <th className="px-4 py-2">Used</th>
                <th className="px-4 py-2">Active</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {coupons.map((coupon) => (
                <tr key={coupon._id} className={editingId === coupon._id ? "bg-amber-50" : ""}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono font-semibold text-gray-800">{coupon.code}</span>{" "}
                    <StatusBadge coupon={coupon} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {describeDiscount(coupon)}
                    <span className="block text-xs text-gray-400">
                      {coupon.discountType === "percent" ? "Percentage" : "Flat amount"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {coupon.minOrderValue > 0 ? `₹${coupon.minOrderValue}` : "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString("en-IN") : "Never"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {coupon.usedCount ?? 0} / {coupon.usageLimit ?? "∞"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={coupon.active}
                      aria-label={`${coupon.active ? "Deactivate" : "Activate"} ${coupon.code}`}
                      onClick={() => handleToggleActive(coupon)}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                        coupon.active ? "bg-emerald-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          coupon.active ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <button onClick={() => handleEdit(coupon)} className="text-blue-600 hover:underline mr-3">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(coupon)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p className="px-4 py-3 text-gray-500 text-sm">Loading...</p>}
          {!loading && coupons.length === 0 && (
            <p className="px-4 py-3 text-gray-500 text-sm">No coupons yet - create one above.</p>
          )}
        </div>
      </div>
    </div>
  );
}
