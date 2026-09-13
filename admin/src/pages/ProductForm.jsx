import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import ImageUploader from "../components/ImageUploader";

// One form component handles both "Add Product" (no :id in the URL)
// and "Edit Product" (:id present) - it just checks useParams().id.
export default function ProductForm() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    stock: "",
    images: [], // array of Cloudinary URLs, populated by ImageUploader below
    lowStockThreshold: 5,
    isNewArrival: true,
    rating: 0,
    reviewCount: 0,
  });
  // Variants: each row is { label, price, stock }. Optional - leave empty for a simple product.
  const [variants, setVariants] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Set after successfully CREATING a product (not editing) - shows the "send a New
  // Arrival WhatsApp broadcast?" prompt below instead of navigating away immediately.
  const [createdProduct, setCreatedProduct] = useState(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // Load categories for the dropdown
  useEffect(() => {
    api.get("/categories").then((res) => setCategories(res.data));
  }, []);

  // If editing, load the existing product's data into the form
  useEffect(() => {
    if (!isEditMode) return;
    api.get(`/products/${id}`).then((res) => {
      const p = res.data;
      setForm({
        name: p.name,
        description: p.description || "",
        price: p.price,
        category: p.category?._id || p.category,
        stock: p.stock,
        images: p.images || [],
        lowStockThreshold: p.lowStockThreshold ?? 5,
        isNewArrival: p.isNewArrival ?? true,
        rating: p.rating ?? 0,
        reviewCount: p.reviewCount ?? 0,
      });
      setVariants(p.variants || []);
    });
  }, [id, isEditMode]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleVariantChange = (index, field, value) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  const addVariantRow = () => {
    setVariants([...variants, { label: "", price: "", stock: "" }]);
  };

  const removeVariantRow = (index) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      category: form.category,
      stock: Number(form.stock),
      lowStockThreshold: Number(form.lowStockThreshold),
      isNewArrival: form.isNewArrival,
      rating: Number(form.rating),
      reviewCount: Number(form.reviewCount),
      images: form.images,
      variants: variants
        .filter((v) => v.label) // ignore empty rows
        .map((v) => ({ label: v.label, price: Number(v.price), stock: Number(v.stock) })),
    };

    try {
      if (isEditMode) {
        await api.put(`/products/${id}`, payload);
        navigate("/products");
      } else {
        const { data } = await api.post("/products", payload);
        // Don't navigate away yet - offer the "New Arrival" broadcast prompt below first.
        setCreatedProduct(data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendBroadcast = async () => {
    setBroadcasting(true);
    try {
      const { data } = await api.post(`/products/${createdProduct._id}/broadcast-new-arrival`);
      setBroadcastResult(data);
    } catch (err) {
      setError(err.response?.data?.message || "Broadcast failed");
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-800 mb-4">
          {isEditMode ? "Edit Product" : "Add Product"}
        </h1>

        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

        {createdProduct && (
          <div className="bg-white p-6 rounded-lg shadow-sm mb-4">
            <p className="text-emerald-700 font-medium mb-1">
              "{createdProduct.name}" was added successfully!
            </p>
            {broadcastResult ? (
              <p className="text-sm text-gray-600 mt-2">
                Sent to {broadcastResult.sent} of {broadcastResult.recipientCount} opted-in customer
                {broadcastResult.recipientCount === 1 ? "" : "s"}
                {broadcastResult.failed > 0 && `, ${broadcastResult.failed} failed`}
                {broadcastResult.skipped > 0 &&
                  ` (${broadcastResult.skipped} skipped - WhatsApp not yet configured)`}
                .
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-3">
                Send a "New Arrival" WhatsApp update to opted-in customers now?
              </p>
            )}
            <div className="flex gap-3 mt-3">
              {!broadcastResult && (
                <button
                  onClick={handleSendBroadcast}
                  disabled={broadcasting}
                  title="This will message all WhatsApp opted-in customers"
                  className="bg-emerald-600 text-white rounded px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {broadcasting ? "Sending..." : "Send Broadcast"}
                </button>
              )}
              <button
                onClick={() => navigate("/products")}
                className="bg-gray-200 text-gray-700 rounded px-4 py-2 text-sm hover:bg-gray-300"
              >
                {broadcastResult ? "Done - Back to Products" : "Skip"}
              </button>
            </div>
          </div>
        )}

        {!createdProduct && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Price (₹)
              </label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                required
                min="0"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base Stock</label>
              <input
                type="number"
                name="stock"
                value={form.stock}
                onChange={handleChange}
                required
                min="0"
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              name="isNewArrival"
              checked={form.isNewArrival}
              onChange={handleChange}
            />
            Mark as new arrival (shows a "New" badge on the storefront for its first 7 days)
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating (0-5)</label>
              <input
                type="number"
                name="rating"
                value={form.rating}
                onChange={handleChange}
                min="0"
                max="5"
                step="0.1"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Reviews
              </label>
              <input
                type="number"
                name="reviewCount"
                value={form.reviewCount}
                onChange={handleChange}
                min="0"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <p className="col-span-2 text-xs text-gray-400 -mt-2">
              Only fill these in with genuine customer feedback you've collected. Stars are hidden
              on the storefront while Number of Reviews is 0, so a product with no real ratings
              shows none rather than an invented score.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Low Stock Alert Threshold
            </label>
            <input
              type="number"
              name="lowStockThreshold"
              value={form.lowStockThreshold}
              onChange={handleChange}
              min="0"
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-400 mt-1">
              The dashboard's Low Stock widget flags this product when stock (or any
              variant's stock) falls at or below this number.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <ImageUploader
            images={form.images}
            onImagesChange={(images) => setForm((prev) => ({ ...prev, images }))}
          />

          {/* Variants - optional, e.g. 500g / 1kg, each with its own price + stock */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Variants (optional)
              </label>
              <button
                type="button"
                onClick={addVariantRow}
                className="text-sm text-emerald-700 hover:underline"
              >
                + Add variant
              </button>
            </div>

            {variants.map((variant, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  placeholder="Label (e.g. 500g)"
                  value={variant.label}
                  onChange={(e) => handleVariantChange(index, "label", e.target.value)}
                  className="flex-1 border rounded px-3 py-2"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={variant.price}
                  onChange={(e) => handleVariantChange(index, "price", e.target.value)}
                  className="w-24 border rounded px-3 py-2"
                />
                <input
                  type="number"
                  placeholder="Stock"
                  value={variant.stock}
                  onChange={(e) => handleVariantChange(index, "stock", e.target.value)}
                  className="w-24 border rounded px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => removeVariantRow(index)}
                  className="text-red-600 px-2"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-gray-900 text-white rounded py-2.5 hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? "Saving..." : isEditMode ? "Update Product" : "Add Product"}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
