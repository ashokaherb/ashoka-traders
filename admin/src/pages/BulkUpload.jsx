import { useEffect, useState } from "react";
import api from "../api/axios";

// GET /products is paginated (max 100 per page) - the CSV template needs every product.
async function fetchAllProducts() {
  const all = [];
  for (let page = 1; ; page++) {
    const { data } = await api.get("/products", { params: { page, limit: 100 } });
    all.push(...data.data);
    if (page >= data.totalPages) return all;
  }
}

export default function BulkUpload() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchAllProducts().then(setProducts);
  }, []);

  // Generates a ready-to-edit CSV from the current product list, so the admin
  // knows exactly which productId (Mongo _id) goes with which product - there's
  // no separate SKU field in this project, the productId column IS the product's id.
  const downloadTemplate = () => {
    const header = "productId,name,stock,price";
    const rows = products.map((p) => `${p._id},"${p.name.replace(/"/g, '""')}",${p.stock},${p.price}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data } = await api.post("/products/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      fetchAllProducts().then(setProducts); // refresh template data
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-800 mb-4">Bulk Stock Upload</h1>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-gray-600 mb-3">
            Upload a CSV with columns <code className="bg-gray-100 px-1 rounded">productId</code>,{" "}
            <code className="bg-gray-100 px-1 rounded">stock</code>, and optionally{" "}
            <code className="bg-gray-100 px-1 rounded">price</code>. Not sure of the product IDs? Download
            a ready-made template below, edit the numbers, and re-upload it. The regular
            Add/Edit Product form still works exactly as before alongside this.
          </p>

          <button onClick={downloadTemplate} className="text-sm text-emerald-700 hover:underline mb-4">
            Download current products as CSV template
          </button>

          {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

          <form onSubmit={handleUpload} className="flex flex-col gap-3">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files[0])}
              className="border rounded px-3 py-2"
            />
            <button
              type="submit"
              disabled={!file || uploading}
              className="bg-gray-900 text-white rounded py-2 hover:bg-gray-800 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload CSV"}
            </button>
          </form>

          {result && (
            <div className="mt-4 border-t pt-4 text-sm">
              <p className="text-emerald-700 font-medium">{result.updatedCount} product(s) updated.</p>
              {result.failedCount > 0 && (
                <>
                  <p className="text-red-600 font-medium mt-2">{result.failedCount} row(s) failed:</p>
                  <ul className="list-disc list-inside text-red-600">
                    {result.failures.map((f, idx) => (
                      <li key={idx}>
                        Row {f.row}
                        {f.productId ? ` (${f.productId})` : ""}: {f.reason}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
