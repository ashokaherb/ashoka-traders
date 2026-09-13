import { useEffect, useState } from "react";
import api from "../api/axios";
import SingleImageUploader from "../components/SingleImageUploader";

// Must match backend/controllers/categoryController.js's MAX_NAV_CATEGORIES - this
// only gives an early, friendly warning; the backend is what actually enforces it.
const MAX_NAV_CATEGORIES = 4;

export default function CategoryManagement() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [showInNav, setShowInNav] = useState(false);
  const [editingId, setEditingId] = useState(null); // category._id currently being edited, or null
  const [error, setError] = useState("");

  // How many categories (other than the one currently being edited) already occupy a
  // nav bar slot - used to disable the checkbox once all 4 are taken.
  const navSlotsUsed = categories.filter((c) => c.showInNav && c._id !== editingId).length;
  const navSlotsFull = navSlotsUsed >= MAX_NAV_CATEGORIES;

  const loadCategories = () => {
    api.get("/categories").then((res) => setCategories(res.data));
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const resetForm = () => {
    setName("");
    setDescription("");
    setImage("");
    setShowInNav(false);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await api.put(`/categories/${editingId}`, { name, description, image, showInNav });
      } else {
        await api.post("/categories", { name, description, image, showInNav });
      }
      resetForm();
      loadCategories();
    } catch (err) {
      setError(err.response?.data?.message || "Save failed");
    }
  };

  const handleEdit = (category) => {
    setEditingId(category._id);
    setName(category.name);
    setDescription(category.description || "");
    setImage(category.image || "");
    setShowInNav(category.showInNav || false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    await api.delete(`/categories/${id}`);
    loadCategories();
  };

  return (
    <div>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-800 mb-4">Categories</h1>

        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col gap-3">
          <div className="flex gap-3">
            <input
              placeholder="Category name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="border rounded px-3 py-2 flex-1"
            />
            <input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border rounded px-3 py-2 flex-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Image (optional)
            </label>
            <SingleImageUploader value={image} onChange={setImage} />
            <p className="text-xs text-gray-400 mt-1">
              Shown on the storefront's category cards. Leave blank to show a coloured tile with
              the category's initial instead.
            </p>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showInNav}
                disabled={!showInNav && navSlotsFull}
                onChange={(e) => setShowInNav(e.target.checked)}
              />
              Show in navigation bar
            </label>
            <p className="text-xs text-gray-400 mt-1">
              The nav bar only has room for {MAX_NAV_CATEGORIES} categories ({navSlotsUsed}/
              {MAX_NAV_CATEGORIES} used{editingId ? " by other categories" : ""}). Every category
              is still reachable via "Shop by Category" and the shop page regardless of this.
              {!showInNav && navSlotsFull && " Uncheck one below to free up a slot."}
            </p>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 hover:bg-gray-800">
              {editingId ? "Update" : "Add"}
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
          {categories.map((cat) => (
            <div key={cat._id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {cat.image ? (
                  <img
                    src={cat.image}
                    alt=""
                    className="w-10 h-10 rounded object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-sm font-semibold">
                    {cat.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-800 flex items-center gap-2">
                    {cat.name}
                    {cat.showInNav && (
                      <span className="text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                        In Nav
                      </span>
                    )}
                  </p>
                  {cat.description && <p className="text-sm text-gray-500">{cat.description}</p>}
                </div>
              </div>
              <div className="flex gap-2 text-sm">
                <button onClick={() => handleEdit(cat)} className="text-blue-600 hover:underline">
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(cat._id)}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="px-4 py-3 text-gray-500 text-sm">No categories yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
