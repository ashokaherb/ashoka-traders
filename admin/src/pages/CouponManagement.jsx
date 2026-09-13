import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyForm = { code: "", discountType: "percent", value: "", active: true, expiryDate: "" };

export default function CouponManagement() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const loadCoupons = () => api.get("/coupons").then((res) => setCoupons(res.data));

  useEffect(() => {
    loadCoupons();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const payload = {
      code: form.code,
      discountType: form.discountType,
      value: Number(form.value),
      active: form.active,
      expiryDate: form.expiryDate || null,
    };

    try {
      if (editingId) {
        await api.put(`/coupons/${editingId}`, payload);
      } else {
        await api.post("/coupons", payload);
      }
      resetForm();
      loadCoupons();
    } catch (err) {
      setError(err.response?.data?.message || "Save failed");
    }
  };

  const handleEdit = (coupon) => {
    setEditingId(coupon._id);
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      value: coupon.value,
      active: coupon.active,
      expiryDate: coupon.expiryDate ? coupon.expiryDate.slice(0, 10) : "",
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this coupon?")) return;
    await api.delete(`/coupons/${id}`);
    loadCoupons();
  };

  const handleToggleActive = async (coupon) => {
    await api.put(`/coupons/${coupon._id}`, { active: !coupon.active });
    loadCoupons();
  };

  const isExpired = (coupon) => coupon.expiryDate && new Date(coupon.expiryDate) < new Date();

  return (
    <div>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-800 mb-4">Coupons</h1>

        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm mb-6 grid grid-cols-2 gap-3">
          <input
            name="code"
            placeholder="Code (e.g. WELCOME10)"
            value={form.code}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2 col-span-2"
          />
          <select
            name="discountType"
            value={form.discountType}
            onChange={handleChange}
            className="border rounded px-3 py-2"
          >
            <option value="percent">Percent off</option>
            <option value="flat">Flat amount off</option>
          </select>
          <input
            type="number"
            name="value"
            placeholder={form.discountType === "percent" ? "e.g. 10 (for 10%)" : "e.g. 100 (for ₹100)"}
            value={form.value}
            onChange={handleChange}
            required
            min="0"
            className="border rounded px-3 py-2"
          />
          <div>
            <label className="text-xs text-gray-500">Expiry date (optional)</label>
            <input
              type="date"
              name="expiryDate"
              value={form.expiryDate}
              onChange={handleChange}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" checked={form.active} onChange={handleChange} />
            Active
          </label>

          <div className="col-span-2 flex gap-2">
            <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 hover:bg-gray-800">
              {editingId ? "Update Coupon" : "Create Coupon"}
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

        <div className="bg-white rounded-lg shadow-sm divide-y">
          {coupons.map((coupon) => (
            <div key={coupon._id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-gray-800">
                  {coupon.code}
                  {isExpired(coupon) && (
                    <span className="ml-2 text-xs text-red-500 font-normal">Expired</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {coupon.discountType === "percent" ? `${coupon.value}% off` : `₹${coupon.value} off`}
                  {coupon.expiryDate && ` - expires ${coupon.expiryDate.slice(0, 10)}`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={coupon.active} onChange={() => handleToggleActive(coupon)} />
                  Active
                </label>
                <button onClick={() => handleEdit(coupon)} className="text-blue-600 hover:underline">
                  Edit
                </button>
                <button onClick={() => handleDelete(coupon._id)} className="text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {coupons.length === 0 && <p className="px-4 py-3 text-gray-500 text-sm">No coupons yet.</p>}
        </div>
      </div>
    </div>
  );
}
