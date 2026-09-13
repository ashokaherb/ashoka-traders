import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyForm = { title: "", discountPercent: "", appliesTo: "all", startDate: "", endDate: "" };

export default function OfferManagement() {
  const [offers, setOffers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [broadcastingId, setBroadcastingId] = useState(null);
  const [broadcastResult, setBroadcastResult] = useState(null); // { offerId, recipientCount, sent, failed, skipped }

  const loadOffers = () => api.get("/offers").then((res) => setOffers(res.data));

  useEffect(() => {
    loadOffers();
    api.get("/categories").then((res) => setCategories(res.data));
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const payload = {
      title: form.title,
      discountPercent: Number(form.discountPercent),
      appliesTo: form.appliesTo,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };

    try {
      if (editingId) {
        await api.put(`/offers/${editingId}`, payload);
      } else {
        await api.post("/offers", payload);
      }
      resetForm();
      loadOffers();
    } catch (err) {
      setError(err.response?.data?.message || "Save failed");
    }
  };

  const handleEdit = (offer) => {
    setEditingId(offer._id);
    setForm({
      title: offer.title,
      discountPercent: offer.discountPercent,
      appliesTo: offer.appliesTo,
      startDate: offer.startDate ? offer.startDate.slice(0, 10) : "",
      endDate: offer.endDate ? offer.endDate.slice(0, 10) : "",
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this offer?")) return;
    await api.delete(`/offers/${id}`);
    loadOffers();
  };

  const handleToggleActive = async (offer) => {
    await api.put(`/offers/${offer._id}`, { active: !offer.active });
    loadOffers();
  };

  const handleBroadcast = async (offer) => {
    if (
      !window.confirm(
        `This will message ALL WhatsApp opted-in customers about "${offer.title}". Send now?`
      )
    ) {
      return;
    }

    setBroadcastingId(offer._id);
    setBroadcastResult(null);
    try {
      const { data } = await api.post(`/offers/${offer._id}/broadcast`);
      setBroadcastResult({ offerId: offer._id, ...data });
    } catch (err) {
      setError(err.response?.data?.message || "Broadcast failed");
    } finally {
      setBroadcastingId(null);
    }
  };

  const categoryName = (id) => categories.find((c) => c._id === id)?.name;

  return (
    <div>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-800 mb-4">Offers &amp; Banners</h1>

        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              name="title"
              placeholder="Offer title (e.g. Flat 20% off on Spices)"
              value={form.title}
              onChange={handleChange}
              required
              className="border rounded px-3 py-2 col-span-2"
            />
            <input
              type="number"
              name="discountPercent"
              placeholder="Discount %"
              value={form.discountPercent}
              onChange={handleChange}
              required
              min="1"
              max="90"
              className="border rounded px-3 py-2"
            />
            <select
              name="appliesTo"
              value={form.appliesTo}
              onChange={handleChange}
              className="border rounded px-3 py-2"
            >
              <option value="all">All products</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} only
                </option>
              ))}
            </select>
            <div>
              <label className="text-xs text-gray-500">Start date (optional)</label>
              <input
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">End date (optional)</label>
              <input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 hover:bg-gray-800">
              {editingId ? "Update Offer" : "Create Offer"}
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
          {offers.map((offer) => (
            <div key={offer._id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{offer.title}</p>
                  <p className="text-xs text-gray-500">
                    {offer.discountPercent}% off -{" "}
                    {offer.appliesTo === "all" ? "All products" : categoryName(offer.appliesTo) || "Unknown category"}
                    {offer.startDate && ` - from ${offer.startDate.slice(0, 10)}`}
                    {offer.endDate && ` to ${offer.endDate.slice(0, 10)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={offer.active} onChange={() => handleToggleActive(offer)} />
                    Active
                  </label>
                  <button onClick={() => handleEdit(offer)} className="text-blue-600 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(offer._id)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                  <button
                    onClick={() => handleBroadcast(offer)}
                    disabled={broadcastingId === offer._id}
                    title="This will message all WhatsApp opted-in customers"
                    className="text-emerald-700 hover:underline disabled:opacity-50"
                  >
                    {broadcastingId === offer._id ? "Sending..." : "Send WhatsApp Broadcast"}
                  </button>
                </div>
              </div>
              {broadcastResult?.offerId === offer._id && (
                <p className="text-xs text-gray-500 mt-2">
                  Sent to {broadcastResult.sent} of {broadcastResult.recipientCount} opted-in customer
                  {broadcastResult.recipientCount === 1 ? "" : "s"}
                  {broadcastResult.failed > 0 && `, ${broadcastResult.failed} failed`}
                  {broadcastResult.skipped > 0 && ` (${broadcastResult.skipped} skipped - WhatsApp not yet configured)`}
                  .
                </p>
              )}
            </div>
          ))}
          {offers.length === 0 && <p className="px-4 py-3 text-gray-500 text-sm">No offers yet.</p>}
        </div>
      </div>
    </div>
  );
}
