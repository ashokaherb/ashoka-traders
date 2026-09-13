import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import api from "../api/axios";
import CategoryFilter from "../components/CategoryFilter";
import ProductGrid from "../components/ProductGrid";
import { Close } from "../components/icons";

/**
 * The full catalogue, serving two routes:
 *   /shop                  - everything, optionally filtered by ?search=
 *   /category/:slug        - one category (its own clean, crawlable URL)
 *
 * The header's search box navigates here with ?search=, so this is also the
 * search results page.
 */
export default function Shop() {
  const { slug: categorySlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const search = searchParams.get("search") || "";

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]));
  }, []);

  const selectedCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;
  const selectedCategoryId = selectedCategory?._id || "";

  // Wait for categories before fetching, so a category URL doesn't briefly show
  // the whole catalogue before the filter resolves.
  const waitingForCategory = Boolean(categorySlug) && categories.length === 0;

  useEffect(() => {
    if (waitingForCategory) return;

    setLoading(true);
    const params = {};
    if (selectedCategoryId) params.category = selectedCategoryId;
    if (search) params.search = search;

    api
      .get("/products", { params })
      .then((res) => setProducts(res.data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [selectedCategoryId, search, waitingForCategory]);

  // CategoryFilter works in category ids - translate its choice back into a route.
  const handleSelectCategory = (categoryId) => {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    if (!categoryId) {
      navigate(`/shop${query}`);
      return;
    }
    const category = categories.find((c) => c._id === categoryId);
    if (category) navigate(`/category/${category.slug}${query}`);
  };

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("search");
    setSearchParams(next);
  };

  const heading = selectedCategory ? selectedCategory.name : search ? "Search results" : "All Products";
  const pageTitle = selectedCategory
    ? `${selectedCategory.name} - Ashoka Traders`
    : search
      ? `Search: ${search} - Ashoka Traders`
      : "Shop All Products - Ashoka Traders";
  const pageDescription = selectedCategory
    ? `Shop ${selectedCategory.name} at Ashoka Traders - quality products, fast delivery, cash on delivery available.`
    : "Browse the full range of dry fruits, herbs and everyday essentials at Ashoka Traders.";

  return (
    <div className="bg-cream min-h-screen">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
      </Helmet>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-brand-700 tracking-tight">{heading}</h1>
          {selectedCategory?.description && (
            <p className="text-sm text-gray-500 mt-1 max-w-full break-words">
              {selectedCategory.description}
            </p>
          )}
          {search && (
            <button
              onClick={clearSearch}
              className="mt-2 inline-flex items-center gap-1 text-xs bg-white border border-cream-dark rounded-full px-3 py-1 text-gray-600 hover:text-brand-700"
            >
              &quot;{search}&quot;
              <Close className="w-3 h-3" />
            </button>
          )}
        </div>

        <CategoryFilter
          categories={categories}
          selected={selectedCategoryId}
          onSelect={handleSelectCategory}
        />

        <ProductGrid
          products={products}
          loading={loading || waitingForCategory}
          skeletonCount={12}
          emptyMessage={
            search
              ? `No products matched "${search}". Try a different search.`
              : "No products in this category yet."
          }
        />
      </div>
    </div>
  );
}
