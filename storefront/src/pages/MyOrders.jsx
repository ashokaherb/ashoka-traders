import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { downloadBlob } from "../utils/downloadFile";

const statusColor = {
  Placed: "bg-blue-100 text-blue-700",
  Packed: "bg-yellow-100 text-yellow-700",
  Shipped: "bg-purple-100 text-purple-700",
  Delivered: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};

// Orders load 10 at a time with "Load More" (audit M3) - most customers only need the latest few.
const PAGE_SIZE = 10;

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = (pageNumber) =>
    api.get("/orders/my", { params: { page: pageNumber, limit: PAGE_SIZE } }).then((res) => {
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
      return res.data.data;
    });

  useEffect(() => {
    fetchPage(1)
      .then(setOrders)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await fetchPage(page + 1);
      setOrders((prev) => {
        const seen = new Set(prev.map((o) => o._id));
        return [...prev, ...next.filter((o) => !seen.has(o._id))];
      });
    } catch {
      // Button stays so they can retry.
    } finally {
      setLoadingMore(false);
    }
  };

  // The invoice route requires an auth header, so it can't be a plain <a href> link -
  // fetch it as a blob and trigger the download ourselves.
  const handleDownloadInvoice = async (orderId) => {
    const res = await api.get(`/orders/${orderId}/invoice`, { responseType: "blob" });
    downloadBlob(res.data, `invoice-${orderId}.pdf`);
  };

  if (loading) return <p className="text-center mt-10 text-gray-500">Loading...</p>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-800 mb-4">My Orders</h1>

      {orders.length === 0 ? (
        <p className="text-gray-500">You haven't placed any orders yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <div key={order._id} className="bg-white rounded-lg shadow-sm p-4">
              <button
                onClick={() => setExpandedId(expandedId === order._id ? null : order._id)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <p className="font-medium text-gray-800">Order #{order._id.slice(-8).toUpperCase()}</p>
                  <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${statusColor[order.orderStatus] || "bg-gray-100 text-gray-700"}`}
                  >
                    {order.orderStatus}
                  </span>
                  <span className="font-semibold text-gray-800">₹{order.total}</span>
                </div>
              </button>

              {expandedId === order._id && (
                <div className="mt-3 border-t pt-3 text-sm">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-gray-600 py-0.5">
                      <span>
                        {item.name}
                        {item.variantLabel ? ` (${item.variantLabel})` : ""} x{item.quantity}
                      </span>
                      <span>₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                  <p className="mt-2 text-gray-500">
                    Payment: {order.paymentMethod} ({order.paymentStatus})
                  </p>
                  <button
                    onClick={() => handleDownloadInvoice(order._id)}
                    className="mt-2 text-brand-700 underline"
                  >
                    Download Invoice
                  </button>
                  {order.trackingNumber && (
                    <p className="mt-1 text-gray-500">
                      Tracking number: <span className="font-medium">{order.trackingNumber}</span> &middot;{" "}
                      <a
                        href="https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx"
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-700 underline"
                      >
                        Track on India Post
                      </a>
                    </p>
                  )}
                  {/* No self-service cancel button by design - see Returns.jsx / ContactUs.jsx */}
                  <p className="mt-2 text-gray-500">
                    Need to cancel or have an issue with this order?{" "}
                    <Link to="/contact" className="text-brand-700 underline">
                      Contact us
                    </Link>
                  </p>
                </div>
              )}
            </div>
          ))}

          <div className="mt-2 flex flex-col items-center gap-2">
            <p className="text-xs text-gray-500">
              Showing {orders.length} of {totalCount} orders
            </p>
            {page < totalPages && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="bg-white border border-brand-600 text-brand-700 font-semibold rounded-full px-6 py-2 text-sm hover:bg-brand-600 hover:text-white disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
