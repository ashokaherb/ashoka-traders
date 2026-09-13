import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import Pager from "../components/Pager";

const PAGE_SIZE = 20;

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadProducts = (pageNumber = page) => {
    setLoading(true);
    api
      .get("/products", { params: { page: pageNumber, limit: PAGE_SIZE } })
      .then((res) => {
        // Deleting the last product on the last page -> step back a page.
        if (res.data.data.length === 0 && pageNumber > 1) {
          setPage(pageNumber - 1);
          return;
        }
        setProducts(res.data.data);
        setTotalPages(res.data.totalPages);
        setTotalCount(res.data.totalCount);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    await api.delete(`/products/${id}`);
    loadProducts();
  };

  return (
    <div>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">Products</h1>
          <Link
            to="/products/new"
            className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 text-sm"
          >
            + Add Product
          </Link>
        </div>

        {loading && products.length === 0 ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <>
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Stock</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((product) => (
                  <tr key={product._id}>
                    <td className="px-4 py-2 font-medium text-gray-800">{product.name}</td>
                    <td className="px-4 py-2 text-gray-600">{product.category?.name}</td>
                    <td className="px-4 py-2">₹{product.price}</td>
                    <td className="px-4 py-2">
                      {product.stock}
                      {product.stock <= 5 && (
                        <span className="ml-2 text-xs text-red-500">Low stock</span>
                      )}
                    </td>
                    <td className="px-4 py-2 flex gap-2">
                      <Link
                        to={`/products/${product._id}/edit`}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(product._id)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-gray-500 text-center">
                      No products yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            itemLabel="products"
            disabled={loading}
            onChange={(next) => {
              setPage(next);
              window.scrollTo({ top: 0 });
            }}
          />
          </>
        )}
      </div>
    </div>
  );
}
