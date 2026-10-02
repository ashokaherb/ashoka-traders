import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import Seo from "../components/Seo";
import Breadcrumbs from "../components/Breadcrumbs";
import { SITE } from "../seo/siteConfig";
import { breadcrumbSchema } from "../seo/structuredData";
import { useAppData } from "../context/AppDataContext";
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
 *
 * Products load 20 at a time with a "Load More" button (audit M3) rather than the whole
 * catalogue at once.
 */
const PAGE_SIZE = 20;

export default function Shop() {
  const { slug: categorySlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const search = searchParams.get("search") || "";

  const { categories, categoriesLoading } = useAppData();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const selectedCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;
  const selectedCategoryId = selectedCategory?._id || "";

  // Wait for categories before fetching, so a category URL doesn't briefly show
  // the whole catalogue before the filter resolves.
  const waitingForCategory = Boolean(categorySlug) && categoriesLoading;

  const buildParams = (pageNumber) => {
    const params = { page: pageNumber, limit: PAGE_SIZE };
    if (selectedCategoryId) params.category = selectedCategoryId;
    if (search) params.search = search;
    return params;
  };

  // A new category/search starts again from page 1.
  useEffect(() => {
    if (waitingForCategory) return;

    let cancelled = false;
    setLoading(true);
    api
      .get("/products", { params: buildParams(1) })
      .then((res) => {
        if (cancelled) return;
        setProducts(res.data.data);
        setPage(1);
        setTotalPages(res.data.totalPages);
        setTotalCount(res.data.totalCount);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // buildParams only reads the values listed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId, search, waitingForCategory]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const { data } = await api.get("/products", { params: buildParams(page + 1) });
      // Skip anything already shown, in case a product was added between page loads.
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p._id));
        return [...prev, ...data.data.filter((p) => !seen.has(p._id))];
      });
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch {
      // Leave the button in place so the customer can simply try again.
    } finally {
      setLoadingMore(false);
    }
  };

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

  // ---- SEO -----------------------------------------------------------------
  // Category pages are the main organic landing pages ("buy dry fruits online"), so they
  // get the keyword-first title pattern and a description naming real products from the
  // category - taken from the loaded list, never invented.
  const popularNames = products.slice(0, 3).map((p) => p.name);
  const popularPhrase = popularNames.length
    ? ` Including ${popularNames.join(", ")}.`
    : "";

  const pageTitle = selectedCategory
    ? `${selectedCategory.name} — Buy Online | ${SITE.name}`
    : search
      ? `Search: ${search} | ${SITE.name}`
      : `Shop All Products — Dry Fruits, Herbs & Spices | ${SITE.name}`;

  const pageDescription = selectedCategory
    ? `Buy ${selectedCategory.name.toLowerCase()} online at ${SITE.name}, Dehradun.${popularPhrase} Fresh stock, fair prices, delivery across India with cash on delivery.`
    : search
      ? `Search results for "${search}" at ${SITE.name}.`
      : `Browse the full range of dry fruits, herbs, spices and natural grocery at ${SITE.name}. Delivered across India, cash on delivery available.`;

  const trail = selectedCategory
    ? [{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }, { name: selectedCategory.name }]
    : [];

  return (
    <div className="bg-cream min-h-screen">
      <Seo
        title={pageTitle}
        description={pageDescription}
        /* Search result pages are thin and endless in number: crawl, but don't index. */
        noindex={Boolean(search)}
        jsonLd={breadcrumbSchema(trail)}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
        <div className="mb-4">
          {/* Visible trail - the BreadcrumbList schema above is built from the same array */}
          {trail.length > 0 && <Breadcrumbs trail={trail} />}
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

        {!loading && !waitingForCategory && products.length > 0 && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-xs text-gray-500">
              Showing {products.length} of {totalCount} products
            </p>
            {page < totalPages && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="bg-white border border-brand-600 text-brand-700 font-semibold rounded-full px-6 py-2 text-sm hover:bg-brand-600 hover:text-white disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
