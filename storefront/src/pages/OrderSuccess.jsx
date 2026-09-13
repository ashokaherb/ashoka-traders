import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { downloadBlob } from "../utils/downloadFile";

export default function OrderSuccess() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/orders/${id}`)
      .then((res) => setOrder(res.data))
      .catch(() => setError("Could not load this order"));
  }, [id]);

  const handleDownloadInvoice = async () => {
    const res = await api.get(`/orders/${order._id}/invoice`, { responseType: "blob" });
    downloadBlob(res.data, `invoice-${order._id}.pdf`);
  };

  if (error) return <p className="text-center mt-10 text-red-500">{error}</p>;
  if (!order) return <p className="text-center mt-10 text-gray-500">Loading...</p>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-center">
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-brand-600 text-4xl mb-2">✓</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Order placed successfully!</h1>
        <p className="text-gray-500 mb-6">Order #{order._id.slice(-8).toUpperCase()}</p>

        <div className="text-left border-t pt-4">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm text-gray-600 py-1">
              <span>
                {item.name}
                {item.variantLabel ? ` (${item.variantLabel})` : ""} x{item.quantity}
              </span>
              <span>₹{item.price * item.quantity}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm py-1">
            <span>Shipping</span>
            <span>{order.shippingFee === 0 ? "Free" : `₹${order.shippingFee}`}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-sm py-1 text-brand-700">
              <span>Discount</span>
              <span>-₹{order.discount}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-2 border-t mt-2">
            <span>Total</span>
            <span>₹{order.total}</span>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-500">
          Payment: {order.paymentMethod} ({order.paymentStatus}) &middot; Status: {order.orderStatus}
        </p>

        <div className="mt-6 flex justify-center gap-4">
          <button onClick={handleDownloadInvoice} className="text-brand-700 font-medium underline">
            Download Invoice
          </button>
          <Link to="/my-orders" className="text-brand-700 font-medium">
            View my orders
          </Link>
          <Link to="/" className="text-gray-600">
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
