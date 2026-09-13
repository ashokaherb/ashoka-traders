import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import api from "../api/axios";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import WishlistButton from "../components/WishlistButton";
import RelatedProducts from "../components/RelatedProducts";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [notifyRequested, setNotifyRequested] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/products/slug/${slug}`)
      .then((res) => {
        setProduct(res.data);
        if (res.data.variants?.length > 0) {
          setSelectedVariant(res.data.variants[0]);
        }
      })
      .catch(() => setError("Product not found"))
      .finally(() => setLoading(false));
  }, [slug]);

  // Reset quantity/added-state whenever the chosen variant changes
  useEffect(() => {
    setQuantity(1);
    setAdded(false);
  }, [selectedVariant]);

  if (loading) return <p className="text-center mt-10 text-gray-500">Loading...</p>;
  if (error || !product)
    return <p className="text-center mt-10 text-red-500">{error || "Not found"}</p>;

  // effectivePrice/originalPrice come from the backend's offer decoration - equal
  // unless an active sale applies (see backend/utils/productPricing.js).
  const displayPrice = selectedVariant ? selectedVariant.effectivePrice : product.effectivePrice;
  const originalPrice = selectedVariant ? selectedVariant.originalPrice : product.originalPrice;
  const displayStock = selectedVariant ? selectedVariant.stock : product.stock;
  const hasDiscount = displayPrice < originalPrice;
  const image = product.images?.[0] || "https://placehold.co/500x500?text=No+Image";

  // A short, plain-text description for the <meta name="description"> tag (SEO) -
  // strip to ~155 chars, the point search engines typically truncate at anyway.
  const metaDescription = product.description
    ? product.description.slice(0, 155)
    : `Buy ${product.name} online at Ashoka Traders.`;

  const handleAddToCart = () => {
    addItem(
      {
        productId: product._id,
        variantId: selectedVariant?._id || null,
        name: product.name,
        variantLabel: selectedVariant?.label || null,
        price: displayPrice,
        image,
        stock: displayStock,
      },
      quantity
    );
    setAdded(true);
  };

  const handleNotifyMe = () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/product/${product.slug}`)}`);
      return;
    }
    api.post(`/products/${product._id}/notify`).then(() => setNotifyRequested(true));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Helmet>
        <title>{product.name} - Ashoka Traders</title>
        <meta name="description" content={metaDescription} />
      </Helmet>

      <Link to="/" className="text-sm text-brand-700">
        &larr; Back to products
      </Link>

      {/* min-w-0 on both grid children - without it, a grid item's default min-width
          is "auto", which lets long unbreakable content (e.g. one giant word in the
          description below) force the column - and the whole page - wider than the
          viewport instead of respecting the grid track and wrapping. */}
      <div className="mt-4 bg-white rounded-lg shadow-sm p-6 grid md:grid-cols-2 gap-6">
        <div className="relative min-w-0">
          {/* Not lazy-loaded - this is the largest above-the-fold image on the page */}
          <img src={image} alt={product.name} loading="eager" className="w-full rounded-lg object-cover" />
          <WishlistButton
            productId={product._id}
            className="absolute top-2 right-2 bg-white/90 rounded-full w-9 h-9 text-xl flex items-center justify-center"
          />
        </div>

        <div className="min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            {product.category?.name}
          </p>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">{product.name}</h1>
          {product.offer && (
            <span className="inline-block mt-2 text-xs bg-brand-100 text-brand-700 px-2 py-1 rounded-full font-medium">
              {product.offer.title} - {product.offer.discountPercent}% off
            </span>
          )}
          {/* break-words + max-w-full: an unbroken long string (no spaces) in the
              description would otherwise force this element wider than its
              container, pushing the whole page into horizontal overflow. */}
          <p className="text-gray-600 mt-3 max-w-full break-words">{product.description}</p>

          {/* Variant selector - only shown if the product has variants (e.g. 500g / 1kg) */}
          {product.variants?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Options:</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant._id}
                    onClick={() => setSelectedVariant(variant)}
                    className={`px-3 py-1.5 rounded border text-sm ${
                      selectedVariant?._id === variant._id
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {variant.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-4">
            <span className="text-3xl font-bold text-brand-700">₹{displayPrice}</span>
            {hasDiscount && <span className="text-lg text-gray-400 line-through">₹{originalPrice}</span>}
          </div>
          <p className={`mt-1 text-sm ${displayStock > 0 ? "text-green-600" : "text-red-500"}`}>
            {displayStock > 0 ? `${displayStock} in stock` : "Out of stock"}
          </p>

          {displayStock > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm text-gray-600">Qty:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200"
                >
                  -
                </button>
                <span className="w-6 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(displayStock, q + 1))}
                  disabled={quantity >= displayStock}
                  className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {displayStock > 0 ? (
            <button
              onClick={handleAddToCart}
              className="mt-6 w-full bg-brand-600 text-white rounded py-2.5 hover:bg-brand-700"
            >
              Add to Cart
            </button>
          ) : (
            <button
              onClick={handleNotifyMe}
              disabled={notifyRequested}
              className="mt-6 w-full bg-gray-800 text-white rounded py-2.5 hover:bg-gray-900 disabled:opacity-50"
            >
              {notifyRequested ? "We'll email you when it's back" : "Notify Me"}
            </button>
          )}

          {added && (
            <div className="mt-3 flex items-center justify-between text-sm bg-brand-50 text-brand-700 rounded p-2">
              <span>Added to cart!</span>
              <button onClick={() => navigate("/cart")} className="underline font-medium">
                View cart
              </button>
            </div>
          )}
        </div>
      </div>

      <RelatedProducts productId={product._id} />
    </div>
  );
}
