import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Pager from "../components/Pager";

const PAGE_SIZE = 20;

export default function OrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const navigate = useNavigate();

  // One page of orders at a time (audit M3) - the table no longer loads every order ever placed.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/orders", { params: { page, limit: PAGE_SIZE } })
      .then((res) => {
        if (cancelled) return;
        setOrders(res.data.data);
        setTotalPages(res.data.totalPages);
        setTotalCount(res.data.totalCount);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  // The export endpoint requires the admin's auth header, so we can't just link
  // to it directly - fetch it as a blob and trigger the download ourselves.
  const handleExport = async () => {
    const res = await api.get("/orders/export", { responseType: "blob" });
    const blob = new Blob([res.data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">Orders</h1>
          <button
            onClick={handleExport}
            className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 text-sm"
          >
            Export as CSV
          </button>
        </div>

        {loading && orders.length === 0 ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <>
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="px-4 py-2">Order #</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Payment</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr
                    key={order._id}
                    onClick={() => navigate(`/orders/${order._id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {order._id.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-2">{order.user?.name}</td>
                    <td className="px-4 py-2">₹{order.total}</td>
                    <td className="px-4 py-2">
                      {order.paymentMethod} ({order.paymentStatus})
                    </td>
                    <td className="px-4 py-2">{order.orderStatus}</td>
                    <td className="px-4 py-2">{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-gray-500 text-center">
                      No orders yet.
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
            itemLabel="orders"
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
