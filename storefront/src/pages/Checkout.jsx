import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { loadRazorpayScript } from "../utils/loadRazorpay";

const emptyAddress = {
  name: "",
  phone: "",
  addressLine: "",
  pincode: "",
  city: "",
  state: "",
  landmark: "",
};

// This page is wrapped in <RequireAuth>, so `user` is always set here.
export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [address, setAddress] = useState(emptyAddress);
  const [saveAddress, setSaveAddress] = useState(true);
  const [pincodeStatus, setPincodeStatus] = useState(""); // "", "looking-up", "found", "not-found"

  // Placeholder values until the real settings load a moment later.
  const [settings, setSettings] = useState({
    freeShippingThreshold: 1000,
    flatShippingFee: 49,
    minimumOrderValue: 0,
  });
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(null); // { code, discount }
  const [couponError, setCouponError] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState([]);

  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // If the cart is empty (e.g. this page was reloaded directly), send them back to shop.
  useEffect(() => {
    if (items.length === 0) navigate("/cart");
  }, [items, navigate]);

  // Pre-fill the form with the customer's previously saved address, if any.
  useEffect(() => {
    if (user?.address) {
      setAddress((prev) => ({ ...prev, ...user.address }));
    }
  }, [user]);

  // Fetch the shipping rule once, just to preview it in the summary panel.
  // The authoritative calculation always happens again on the backend at order time.
  useEffect(() => {
    api.get("/settings").then((res) => setSettings(res.data));
  }, []);

  // Coupons the customer can pick from. Re-fetched if the subtotal changes, since that
  // decides which ones the cart qualifies for. Purely a convenience list - the backend
  // re-checks every rule when the coupon is applied and again when the order is placed.
  useEffect(() => {
    api
      .get("/coupons/available", { params: { subtotal } })
      .then((res) => setAvailableCoupons(res.data))
      .catch(() => setAvailableCoupons([]));
  }, [subtotal]);

  const shippingFee = subtotal >= settings.freeShippingThreshold ? 0 : settings.flatShippingFee;
  const discount = couponApplied?.discount || 0;
  const total = Math.max(subtotal - discount + shippingFee, 0);

  // 0/unset means no minimum enforced - only block checkout when the admin actually set one.
  const belowMinimum = settings.minimumOrderValue > 0 && subtotal < settings.minimumOrderValue;

  const handleAddressChange = (e) => setAddress({ ...address, [e.target.name]: e.target.value });

  // Auto-fill city/state once a valid 6-digit pincode is entered (India Post public API,
  // proxied through our own backend at /api/utils/pincode to avoid CORS issues).
  const handlePincodeBlur = async () => {
    if (!/^\d{6}$/.test(address.pincode)) return;
    setPincodeStatus("looking-up");
    try {
      const { data } = await api.get(`/utils/pincode/${address.pincode}`);
      setAddress((prev) => ({ ...prev, city: data.city, state: data.state }));
      setPincodeStatus("found");
    } catch {
      setPincodeStatus("not-found");
    }
  };

  // `code` is passed directly by the "Apply" buttons on the available-coupon cards.
  const handleApplyCoupon = async (code = couponCode) => {
    setCouponError("");
    if (!code.trim()) return;
    setCouponCode(code);
    try {
      const { data } = await api.post("/coupons/validate", { code: code.trim(), subtotal });
      setCouponApplied(data);
    } catch (err) {
      setCouponApplied(null);
      setCouponError(err.response?.data?.message || "Could not apply coupon");
    }
  };

  const handleRemoveCoupon = () => {
    setCouponApplied(null);
    setCouponCode("");
    setCouponError("");
  };

  const saveAddressIfRequested = async () => {
    if (!saveAddress) return;
    try {
      await api.put("/auth/address", address);
    } catch {
      // Non-fatal - the order should still go through even if saving the address fails.
    }
  };

  // Only send productId/variantId/quantity - price is never trusted from the client,
  // the backend always recomputes it from the current product/variant data.
  const buildItemsPayload = () =>
    items.map((i) => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity }));

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setError("");

    // The backend enforces this too (never trust client-side checks alone), but
    // catching it here avoids a pointless round-trip and gives an immediate message.
    if (belowMinimum) {
      setError(
        `Minimum order value is ₹${settings.minimumOrderValue}. Add ₹${(settings.minimumOrderValue - subtotal).toFixed(2)} more to checkout.`
      );
      return;
    }

    setSubmitting(true);

    try {
      await saveAddressIfRequested();
      const payloadItems = buildItemsPayload();

      if (paymentMethod === "COD") {
        const { data: order } = await api.post("/orders", {
          items: payloadItems,
          address,
          couponCode: couponApplied?.code,
          paymentMethod: "COD",
        });
        clearCart();
        navigate(`/order-success/${order._id}`);
        return;
      }

      // --- Razorpay flow ---
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError("Could not load Razorpay checkout. Check your internet connection and try again.");
        setSubmitting(false);
        return;
      }

      const { data: rp } = await api.post("/orders/razorpay", {
        items: payloadItems,
        couponCode: couponApplied?.code,
      });

      const razorpay = new window.Razorpay({
        key: rp.key,
        amount: rp.amount,
        currency: rp.currency,
        order_id: rp.razorpayOrderId,
        name: "Ashoka Traders",
        description: "Order payment",
        prefill: { name: address.name, contact: address.phone },
        theme: { color: "#3d6923" }, // brand-600, keep in sync with tailwind.config.js
        handler: async (response) => {
          try {
            const { data: order } = await api.post("/orders/razorpay/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              items: payloadItems,
              address,
              couponCode: couponApplied?.code,
            });
            clearCart();
            navigate(`/order-success/${order._id}`);
          } catch (err) {
            setError(err.response?.data?.message || "Payment succeeded but order verification failed");
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => setSubmitting(false), // user closed the popup without paying
        },
      });

      razorpay.open();
      return; // handler/ondismiss above take over from here
    } catch (err) {
      setError(err.response?.data?.message || "Could not place order");
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 grid md:grid-cols-3 gap-6">
      <form
        onSubmit={handlePlaceOrder}
        className="md:col-span-2 bg-white rounded-lg shadow-sm p-6 flex flex-col gap-4"
      >
        <h1 className="text-xl font-bold text-gray-800">Shipping Address</h1>

        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
        {belowMinimum && !error && (
          <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
            Minimum order value is ₹{settings.minimumOrderValue} - add ₹
            {(settings.minimumOrderValue - subtotal).toFixed(2)} more to your cart to check out.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <input
            name="name"
            placeholder="Full name"
            value={address.name}
            onChange={handleAddressChange}
            required
            className="border rounded px-3 py-2"
          />
          <input
            name="phone"
            placeholder="Phone"
            value={address.phone}
            onChange={handleAddressChange}
            required
            className="border rounded px-3 py-2"
          />
        </div>

        <input
          name="addressLine"
          placeholder="Address (house no, street, area)"
          value={address.addressLine}
          onChange={handleAddressChange}
          required
          className="border rounded px-3 py-2"
        />

        <div className="grid grid-cols-3 gap-3">
          <div>
            <input
              name="pincode"
              placeholder="Pincode"
              value={address.pincode}
              onChange={handleAddressChange}
              onBlur={handlePincodeBlur}
              maxLength={6}
              required
              className="border rounded px-3 py-2 w-full"
            />
            {pincodeStatus === "looking-up" && <p className="text-xs text-gray-400 mt-1">Looking up...</p>}
            {pincodeStatus === "not-found" && (
              <p className="text-xs text-red-500 mt-1">Pincode not found - enter city/state manually</p>
            )}
          </div>
          <input
            name="city"
            placeholder="City"
            value={address.city}
            onChange={handleAddressChange}
            required
            className="border rounded px-3 py-2"
          />
          <input
            name="state"
            placeholder="State"
            value={address.state}
            onChange={handleAddressChange}
            required
            className="border rounded px-3 py-2"
          />
        </div>

        <input
          name="landmark"
          placeholder="Landmark (optional)"
          value={address.landmark}
          onChange={handleAddressChange}
          className="border rounded px-3 py-2"
        />

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
          Save this address to my profile for next time
        </label>

        <h2 className="text-lg font-bold text-gray-800 mt-4">Payment Method</h2>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="paymentMethod"
              value="COD"
              checked={paymentMethod === "COD"}
              onChange={() => setPaymentMethod("COD")}
            />
            Cash on Delivery
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="paymentMethod"
              value="Razorpay"
              checked={paymentMethod === "Razorpay"}
              onChange={() => setPaymentMethod("Razorpay")}
            />
            Pay Online (Razorpay)
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting || belowMinimum}
          className="mt-4 bg-brand-600 text-white rounded py-2.5 hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Placing order..." : belowMinimum ? "Add more to checkout" : `Place Order - ₹${total}`}
        </button>
      </form>

      <div className="bg-white rounded-lg shadow-sm p-6 h-fit">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Order Summary</h2>

        <div className="flex flex-col gap-2 text-sm mb-4">
          {items.map((i) => (
            <div key={`${i.productId}-${i.variantId || "base"}`} className="flex justify-between text-gray-600">
              <span>
                {i.name}
                {i.variantLabel ? ` (${i.variantLabel})` : ""} x{i.quantity}
              </span>
              <span>₹{i.price * i.quantity}</span>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>₹{subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{shippingFee === 0 ? "Free" : `₹${shippingFee}`}</span>
          </div>
          {couponApplied && (
            <div className="flex justify-between text-brand-700">
              <span>Discount ({couponApplied.code})</span>
              <span>-₹{discount}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-2 border-t mt-2">
            <span>Total</span>
            <span>₹{total}</span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex gap-2">
            <input
              placeholder="Coupon code"
              aria-label="Coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="border rounded px-3 py-2 flex-1 min-w-0 text-sm uppercase"
            />
            {couponApplied ? (
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="bg-gray-200 text-gray-700 rounded px-3 text-sm hover:bg-gray-300"
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleApplyCoupon()}
                className="bg-gray-900 text-white rounded px-3 text-sm hover:bg-gray-800"
              >
                Apply
              </button>
            )}
          </div>
          {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
          {couponApplied && (
            <p className="text-xs text-brand-700 mt-1">Coupon "{couponApplied.code}" applied!</p>
          )}
        </div>

        {availableCoupons.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Available Coupons</h3>
            <ul className="flex flex-col gap-2">
              {availableCoupons.map((c) => {
                const applied = couponApplied?.code === c.code;
                return (
                  <li
                    key={c.code}
                    className={`border border-dashed rounded p-3 flex items-center justify-between gap-3 ${
                      c.eligible ? "border-brand-600 bg-brand-50/40" : "border-gray-300 bg-gray-50 opacity-70"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-gray-800">{c.code}</p>
                      <p className={`text-sm font-bold ${c.eligible ? "text-brand-700" : "text-gray-500"}`}>
                        {c.discountType === "percent" ? `${c.value}% OFF` : `₹${c.value} OFF`}
                      </p>
                      {c.minOrderValue > 0 && (
                        <p className="text-xs text-gray-500">On orders above ₹{c.minOrderValue}</p>
                      )}
                      {!c.eligible && (
                        <p className="text-xs text-amber-700 mt-0.5">Add ₹{c.shortBy} more to use this coupon</p>
                      )}
                    </div>
                    {c.eligible && (
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon(c.code)}
                        disabled={applied}
                        className="shrink-0 text-sm font-semibold text-brand-700 border border-brand-600 rounded px-3 py-1 hover:bg-brand-600 hover:text-white disabled:bg-brand-600 disabled:text-white"
                      >
                        {applied ? "Applied" : "Apply"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
