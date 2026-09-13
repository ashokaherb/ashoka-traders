import { useEffect, useState } from "react";
import api from "../api/axios";
import SingleImageUploader from "../components/SingleImageUploader";

// Homepage banner-carousel management (see storefront/src/components/BannerCarousel.jsx).
// Same Add/Edit-form-plus-list pattern as CategoryManagement.jsx.
export default function BannerManagement() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [image, setImage] = useState("");
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [active, setActive] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadBanners = () => {
    api
      .get("/banners")
      .then((res) => setBanners(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const resetForm = () => {
    setImage("");
    setTitle("");
    setLinkUrl("");
    setActive(true);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image) {
      setError("Please upload a banner image first");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/banners/${editingId}`, { image, title, linkUrl, active });
      } else {
        await api.post("/banners", { image, title, linkUrl, active });
      }
      resetForm();
      loadBanners();
    } catch (err) {
      setError(err.response?.data?.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (banner) => {
    setEditingId(banner._id);
    setImage(banner.image);
    setTitle(banner.title || "");
    setLinkUrl(banner.linkUrl || "");
    setActive(banner.active);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this banner?")) return;
    await api.delete(`/banners/${id}`);
    if (editingId === id) resetForm();
    loadBanners();
  };

  const toggleActive = async (banner) => {
    await api.put(`/banners/${banner._id}`, { active: !banner.active });
    loadBanners();
  };

  // Swaps a banner with its neighbour above/below, then persists the whole new
  // order in one request - see backend's PUT /api/banners/reorder.
  const moveBanner = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const reordered = [...banners];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setBanners(reordered); // optimistic - snappy up/down clicks

    try {
      const { data } = await api.put("/banners/reorder", {
        orderedIds: reordered.map((b) => b._id),
      });
      setBanners(data);
    } catch (err) {
      setError("Could not reorder banners");
      loadBanners(); // fall back to whatever the server actually has
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading banners...</p>;
  }

  return (
    <div className="max-w-3xl">
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col gap-3"
      >
        <h2 className="font-semibold text-gray-700">
          {editingId ? "Edit Banner" : "Add Banner"}
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image</label>
          <SingleImageUploader value={image} onChange={setImage} />
          <p className="text-xs text-gray-400 mt-1">
            Recommended: 1200x400px (a 3:1 wide strip) for desktop - it will auto-crop to fit on
            mobile, so keep anything important centred rather than at the far edges.
          </p>
        </div>

        <div className="flex gap-3">
          <input
            placeholder="Overlay title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border rounded px-3 py-2 flex-1"
          />
          <input
            placeholder="Link URL (optional, e.g. /category/spices)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="border rounded px-3 py-2 flex-1"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (visible in the storefront carousel)
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-gray-900 text-white rounded px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? "Saving..." : editingId ? "Update" : "Add Banner"}
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
        {banners.map((banner, index) => (
          <div key={banner._id} className="flex items-center gap-3 px-4 py-3">
            <img
              src={banner.image}
              alt=""
              className="w-20 h-12 rounded object-cover border border-gray-200 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-800 truncate">
                {banner.title || <span className="text-gray-400 italic">No title</span>}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {banner.linkUrl || "Not clickable"}
              </p>
            </div>

            <button
              onClick={() => toggleActive(banner)}
              className={`text-[11px] uppercase tracking-wide rounded-full px-2 py-0.5 shrink-0 ${
                banner.active
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {banner.active ? "Active" : "Inactive"}
            </button>

            <div className="flex flex-col shrink-0">
              <button
                onClick={() => moveBanner(index, -1)}
                disabled={index === 0}
                aria-label="Move up"
                className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:hover:text-gray-400 leading-none"
              >
                &#9650;
              </button>
              <button
                onClick={() => moveBanner(index, 1)}
                disabled={index === banners.length - 1}
                aria-label="Move down"
                className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:hover:text-gray-400 leading-none"
              >
                &#9660;
              </button>
            </div>

            <div className="flex gap-2 text-sm shrink-0">
              <button onClick={() => handleEdit(banner)} className="text-blue-600 hover:underline">
                Edit
              </button>
              <button
                onClick={() => handleDelete(banner._id)}
                className="text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {banners.length === 0 && (
          <p className="px-4 py-3 text-gray-500 text-sm">
            No banners yet - add one above to start the homepage carousel.
          </p>
        )}
      </div>
    </div>
  );
}
