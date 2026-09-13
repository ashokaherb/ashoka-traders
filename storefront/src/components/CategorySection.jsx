import { Link } from "react-router-dom";
import SectionHeading from "./SectionHeading";
import { getCloudinaryThumbnail } from "../utils/cloudinary";

/**
 * "Shop by Category" - a horizontally scrollable strip on mobile that becomes a
 * grid from `lg` up. Category images come from the admin (Category.image); when one
 * isn't set the card falls back to a brand-coloured tile with the category initial,
 * so the row always looks intentional rather than broken.
 */
export default function CategorySection({ categories, loading }) {
  if (!loading && categories.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-4 py-8">
      <SectionHeading title="Shop by Category" linkTo="/shop" linkLabel="View All Categories" />

      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="shrink-0 w-28 sm:w-36">
              <div className="aspect-square rounded-2xl bg-cream-dark animate-pulse" />
              <div className="h-3 mt-2 rounded bg-cream-dark animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar snap-x lg:grid lg:grid-cols-6 lg:overflow-visible pb-1">
          {categories.map((category) => (
            <Link
              key={category._id}
              to={`/category/${category.slug}`}
              className="group shrink-0 w-28 sm:w-36 lg:w-auto snap-start"
            >
              <div className="aspect-square rounded-2xl overflow-hidden bg-brand-50 border border-cream-dark group-hover:border-brand-300 group-hover:shadow-md transition-all">
                {category.image ? (
                  <img
                    src={getCloudinaryThumbnail(category.image, 360)} // tiles are 112-180px wide
                    alt={category.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200">
                    <span className="text-3xl font-bold text-brand-600">
                      {category.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-2 text-center text-xs sm:text-sm font-medium text-gray-700 group-hover:text-brand-700 line-clamp-2">
                {category.name}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
