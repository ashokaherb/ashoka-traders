import { Star } from "./icons";

/**
 * Star rating row, e.g. ★★★★☆ (4.5).
 *
 * Renders nothing at all unless the product actually has ratings (reviewCount > 0),
 * so a product with no feedback yet shows no stars rather than an invented score.
 * Set `rating`/`reviewCount` on the product from the admin product form.
 */
export default function StarRating({ rating = 0, reviewCount = 0, className = "" }) {
  if (!reviewCount || !rating) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex text-accent">
        {[0, 1, 2, 3, 4].map((index) => (
          <Star
            key={index}
            id={`${index}-${rating}`}
            fill={Math.max(0, Math.min(1, rating - index))}
            className="w-3.5 h-3.5"
          />
        ))}
      </div>
      <span className="text-xs text-gray-400">({rating.toFixed(1)})</span>
    </div>
  );
}
