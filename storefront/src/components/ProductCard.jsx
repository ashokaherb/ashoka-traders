import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import WishlistButton from "./WishlistButton";
import StarRating from "./StarRating";
import { Cart } from "./icons";
import { getCloudinaryThumbnail } from "../utils/cloudinary";

/**
 * Product card used by the homepage grid, Shop, Related Products and the Wishlist.
 *
 * For a product WITH variants the card shows (and adds) the first variant - so the
 * weight label and price on the card always match exactly what the Add to Cart
 * button puts in the basket. Customers who want a different size click through to
 * the product page.
 *
 * Both the heart and Add to Cart work without an account (see CartContext /
 * WishlistContext for how guest state is stored and later merged).
 *
 * Badges: "New" is a ribbon-style tag that overhangs the card's top edge (drawn
 * outside the image's own rounded/clipped box, so it isn't cut off) - "% off" and
 * "Bestseller" stay inside the image like a normal corner badge. `showBestSellerBadge`
 * is passed in by whichever section is listing best-sellers (see ProductGrid) rather
 * than being something the product itself knows about.
 */
export default function ProductCard({ product, showBestSellerBadge = false }) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const image = product.images?.[0] || "https://placehold.co/400x400/f0e9db/2d5016?text=No+Image";
  const firstVariant = product.variants?.length > 0 ? product.variants[0] : null;

  // effectivePrice/originalPrice come from the backend's offer decoration (see
  // utils/productPricing.js) - they're equal unless an active sale applies.
  const price = firstVariant
    ? firstVariant.effectivePrice ?? firstVariant.price
    : product.effectivePrice ?? product.price;
  const originalPrice = firstVariant
    ? firstVariant.originalPrice ?? firstVariant.price
    : product.originalPrice ?? product.price;
  const hasDiscount = price < originalPrice;
  const discountPercent = hasDiscount
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  const stock = firstVariant ? firstVariant.stock : product.stock;
  const outOfStock = stock <= 0;

  // "New" badge: the admin's isNewArrival flag AND still within its first 7 days -
  // so it fades on its own even if the admin never manually turns the flag off.
  const daysSinceCreated = (Date.now() - new Date(product.createdAt).getTime()) / 86400000;
  const showNewBadge = product.isNewArrival && daysSinceCreated <= 7;

  const handleAddToCart = (e) => {
    e.preventDefault(); // the whole card is a <Link>
    e.stopPropagation();

    addItem({
      productId: product._id,
      variantId: firstVariant?._id || null,
      name: product.name,
      variantLabel: firstVariant?.label || null,
      price,
      image,
      stock,
    });

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  return (
    // No overflow-hidden here (unlike before) - the "New" ribbon below is
    // positioned relative to THIS element and needs to spill outside the image's
    // own clipped box. The image wrapper and details box each round their own
    // corners instead, so the card still looks like one rounded rectangle.
    <Link
      to={`/product/${product.slug}`}
      className="group relative bg-white rounded-xl border border-cream-dark hover:border-brand-200 hover:shadow-lg transition-all flex flex-col"
    >
      {/* "New" ribbon - deliberately outside the image wrapper's overflow-hidden,
          so it overhangs the card's top edge instead of sitting flush inside it. */}
      {showNewBadge && (
        <span className="absolute -top-3 left-2.5 z-20 bg-accent text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
          NEW
        </span>
      )}

      {/* Image + overlay controls */}
      <div className="relative bg-cream/50 rounded-t-xl overflow-hidden">
        <img
          // Cards render ~150-300px wide; 400px keeps them sharp on retina without the 1000px original.
          src={getCloudinaryThumbnail(image, 400)}
          alt={product.name}
          loading="lazy"
          className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* These stay INSIDE the image, unlike the New ribbon above */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {hasDiscount && (
            <span className="bg-red-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">
              {discountPercent}% off
            </span>
          )}
          {showBestSellerBadge && (
            <span className="bg-brand-700 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">
              Bestseller
            </span>
          )}
        </div>

        <WishlistButton
          productId={product._id}
          className="absolute top-2 right-2 z-10 bg-white/95 rounded-full w-6 h-6 p-1 shadow-sm"
        />

        {outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-gray-900/70 text-white text-[10px] text-center py-1">
            Out of stock
          </span>
        )}
      </div>

      {/* Details */}
      <div className="p-1.5 sm:p-2 rounded-b-xl flex flex-col gap-0.5 flex-1">
        <h3 className="text-[11px] sm:text-xs font-medium text-gray-800 line-clamp-2 leading-snug group-hover:text-brand-700">
          {product.name}
        </h3>

        {firstVariant && <p className="text-[10px] text-gray-400">{firstVariant.label}</p>}

        <StarRating rating={product.rating} reviewCount={product.reviewCount} />

        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-xs sm:text-sm font-bold text-brand-700">₹{price}</span>
          {hasDiscount && (
            <span className="text-[10px] text-gray-400 line-through">₹{originalPrice}</span>
          )}
        </div>

        <button
          onClick={handleAddToCart}
          disabled={outOfStock}
          className="mt-1 w-full inline-flex items-center justify-center gap-1 bg-brand-600 text-white rounded-lg py-1 text-[10px] sm:text-[11px] font-medium hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Cart className="w-3 h-3" />
          {outOfStock ? "Out of stock" : justAdded ? "Added!" : "Add to Cart"}
        </button>
      </div>
    </Link>
  );
}
