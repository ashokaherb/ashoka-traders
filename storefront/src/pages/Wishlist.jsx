import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import ProductGrid from "../components/ProductGrid";

/**
 * Works for guests as well as logged-in customers:
 *  - logged in  -> the saved wishlist comes from /api/wishlist
 *  - guest      -> WishlistContext holds ids from localStorage, and we resolve them
 *                  into full products via /api/products?ids=...
 */
export default function Wishlist() {
  const { user, loading: authLoading } = useAuth();
  const { wishlistIds } = useWishlist();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        if (user) {
          const { data } = await api.get("/wishlist");
          if (!cancelled) setProducts(data);
        } else if (wishlistIds.length > 0) {
          const { data } = await api.get("/products", { params: { ids: wishlistIds.join(",") } });
          if (!cancelled) setProducts(data.data); // paginated shape - all requested ids come back in one page
        } else if (!cancelled) {
          setProducts([]);
        }
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, wishlistIds]);

  // Reflect removals immediately (e.g. tapping the heart on this very page).
  const visibleProducts = products.filter((p) => wishlistIds.includes(p._id));

  return (
    <div className="bg-cream min-h-screen">
      <Helmet>
        <title>My Wishlist - Ashoka Traders</title>
      </Helmet>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-brand-700 tracking-tight mb-4">
          My Wishlist
        </h1>

        {!loading && visibleProducts.length === 0 ? (
          <div className="bg-white rounded-xl border border-cream-dark p-8 text-center">
            <p className="text-gray-500 mb-3">
              Nothing saved yet - tap the heart icon on any product to add it here.
            </p>
            <Link to="/shop" className="text-brand-600 font-medium hover:text-brand-700">
              Browse products &rarr;
            </Link>
          </div>
        ) : (
          <>
            {!user && visibleProducts.length > 0 && (
              <p className="mb-4 text-xs text-gray-500 bg-white border border-cream-dark rounded-lg px-3 py-2">
                Saved on this device.{" "}
                <Link to="/login" className="text-brand-600 font-medium hover:underline">
                  Log in
                </Link>{" "}
                to keep your wishlist across devices.
              </p>
            )}
            <ProductGrid products={visibleProducts} loading={loading} skeletonCount={6} />
          </>
        )}
      </div>
    </div>
  );
}
