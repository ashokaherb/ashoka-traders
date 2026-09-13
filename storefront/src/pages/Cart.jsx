import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { getCloudinaryThumbnail } from "../utils/cloudinary";

export default function Cart() {
  const { items, updateQuantity, removeItem, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Login/signup is only required at this step, not to browse or add to cart.
  const handleCheckout = () => {
    if (!user) {
      navigate("/login?redirect=" + encodeURIComponent("/checkout"));
    } else {
      navigate("/checkout");
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p className="text-gray-500 mb-4">Your cart is empty.</p>
        <Link to="/" className="text-brand-700 font-medium">
          Continue shopping &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-800 mb-4">Your Cart</h1>

      <div className="bg-white rounded-lg shadow-sm divide-y">
        {items.map((item) => (
          <div key={`${item.productId}-${item.variantId || "base"}`} className="flex items-center gap-4 p-4">
            <img
              src={getCloudinaryThumbnail(item.image, 160) || "https://placehold.co/80x80?text=No+Image"}
              alt={item.name}
              loading="lazy"
              className="w-16 h-16 object-cover rounded"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-800">{item.name}</p>
              {item.variantLabel && <p className="text-xs text-gray-500">{item.variantLabel}</p>}
              <p className="text-brand-700 font-semibold">₹{item.price}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200"
              >
                -
              </button>
              <span className="w-6 text-center">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                disabled={item.quantity >= item.stock}
                className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
              >
                +
              </button>
            </div>
            <p className="w-16 text-right font-medium">₹{item.price * item.quantity}</p>
            <button
              onClick={() => removeItem(item.productId, item.variantId)}
              className="text-red-500 text-sm hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
        <span className="text-lg font-bold text-gray-800">Subtotal: ₹{subtotal}</span>
        <button
          onClick={handleCheckout}
          className="bg-brand-600 text-white rounded px-6 py-2.5 hover:bg-brand-700"
        >
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}
