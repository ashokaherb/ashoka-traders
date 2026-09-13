import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { downloadBlob } from "../utils/downloadFile";

const STATUS_OPTIONS = ["Placed", "Packed", "Shipped", "Delivered", "Cancelled"];
// Actual refunds are processed by the client directly in the Razorpay dashboard - this
// dropdown just lets the admin reflect that status back to the customer's "My Orders".
const PAYMENT_STATUS_OPTIONS = ["pending", "paid", "refund_requested", "refunded"];

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [orderStatus, setOrderStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    api.get(`/orders/${id}`).then((res) => {
      setOrder(res.data);
      setOrderStatus(res.data.orderStatus);
      setPaymentStatus(res.data.paymentStatus);
      setTrackingNumber(res.data.trackingNumber || "");
    });
  };

  useEffect(load, [id]);

  const handleDownloadInvoice = async () => {
    const res = await api.get(`/orders/${id}/invoice`, { responseType: "blob" });
    downloadBlob(res.data, `invoice-${id}.pdf`);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await api.put(`/orders/${id}/status`, { orderStatus, paymentStatus, trackingNumber });
      setMessage("Updated successfully");
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (!order) {
    return (
      <div>
        <p className="text-center mt-10 text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link to="/orders" className="text-sm text-emerald-700">
          &larr; Back to orders
        </Link>

        <div className="mt-4 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold text-gray-800">
              Order #{order._id.slice(-8).toUpperCase()}
            </h1>
            <button onClick={handleDownloadInvoice} className="text-sm text-emerald-700 hover:underline">
              Download Invoice
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">{new Date(order.createdAt).toLocaleString()}</p>

          <h2 className="font-semibold text-gray-700 mb-1">Customer</h2>
          <p className="text-sm text-gray-600 mb-4">
            {order.user?.name} &middot; {order.user?.email}
          </p>

          <h2 className="font-semibold text-gray-700 mb-1">Shipping Address</h2>
          <p className="text-sm text-gray-600 mb-4">
            {order.address.name}, {order.address.phone}
            <br />
            {order.address.addressLine}
            {order.address.landmark && `, ${order.address.landmark}`}
            <br />
            {order.address.city}, {order.address.state} - {order.address.pincode}
          </p>

          <h2 className="font-semibold text-gray-700 mb-1">Items</h2>
          <div className="text-sm mb-4">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between gap-3 py-0.5 text-gray-600">
                <span className="min-w-0">
                  {item.name}
                  {item.variantLabel ? ` (${item.variantLabel})` : ""} x{item.quantity}
                </span>
                {/* Price never wraps - a long product name wraps beside it instead */}
                <span className="shrink-0 whitespace-nowrap">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>

          <div className="text-sm border-t pt-3 mb-4">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹{order.subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>₹{order.shippingFee}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
              <span>-₹{order.discount}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>₹{order.total}</span>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Payment: {order.paymentMethod} ({order.paymentStatus})
          </p>

          <form onSubmit={handleSave} className="border-t pt-4 flex flex-col gap-3">
            <h2 className="font-semibold text-gray-700">Update Order</h2>
            {message && <p className="text-sm text-emerald-700">{message}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Order Status</label>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  className="border rounded px-3 py-2 w-full"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="border rounded px-3 py-2 w-full"
                >
                  {PAYMENT_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <input
              placeholder="Tracking number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
            <button
              type="submit"
              disabled={saving}
              className="bg-gray-900 text-white rounded py-2 hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
