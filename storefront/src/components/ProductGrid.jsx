import ProductCard from "./ProductCard";

/**
 * Responsive product grid: 2 columns on phones, 3 on tablets, 5 on laptops and
 * 6 on wide desktops. Shows skeleton placeholders while loading so the layout
 * doesn't jump once products arrive.
 */
export default function ProductGrid({
  products = [],
  loading = false,
  skeletonCount = 6,
  emptyMessage = "No products found.",
  // Set by whichever section is listing best-sellers (see Home.jsx) - not something
  // the product data itself carries, so every card in THIS grid shows the badge.
  showBestSellerBadge = false,
}) {
  const gridClass =
    "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4";

  if (loading) {
    return (
      <div className={gridClass}>
        {[...Array(skeletonCount)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-cream-dark overflow-hidden">
            <div className="aspect-square bg-cream-dark animate-pulse" />
            <div className="p-2 sm:p-2.5 space-y-2">
              <div className="h-3 rounded bg-cream-dark animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-cream-dark animate-pulse" />
              <div className="h-7 rounded bg-cream-dark animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return <p className="text-gray-500 text-sm py-6">{emptyMessage}</p>;
  }

  return (
    <div className={gridClass} data-testid="product-grid">
      {products.map((product) => (
        <ProductCard key={product._id} product={product} showBestSellerBadge={showBestSellerBadge} />
      ))}
    </div>
  );
}
