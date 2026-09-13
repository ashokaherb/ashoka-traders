import { useWishlist } from "../context/WishlistContext";
import { Heart } from "./icons";

/**
 * Heart icon toggle, used on product cards and the product detail page.
 * Works without an account - guests' saves go to localStorage and get merged
 * into their account when they log in (see WishlistContext).
 */
export default function WishlistButton({ productId, className = "" }) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const active = isWishlisted(productId);

  const handleClick = (e) => {
    // Stop the parent <Link> (ProductCard wraps this in one) from also navigating.
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(productId);
  };

  return (
    <button
      onClick={handleClick}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={active}
      className={`${className} ${
        active ? "text-red-500" : "text-gray-400"
      } hover:text-red-500 transition-colors`}
    >
      <Heart className="w-full h-full" filled={active} />
    </button>
  );
}
