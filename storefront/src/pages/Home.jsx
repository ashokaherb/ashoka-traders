import { lazy, Suspense, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import api from "../api/axios";
import { useAppData } from "../context/AppDataContext";
import useMediaQuery, { LG_BREAKPOINT } from "../hooks/useMediaQuery";
import OfferBanner from "../components/OfferBanner";
import HeroSection from "../components/HeroSection";
import TrustBadges from "../components/TrustBadges";
import CategorySection from "../components/CategorySection";
import SectionHeading from "../components/SectionHeading";
import ProductGrid from "../components/ProductGrid";

/**
 * Homepage / landing page.
 *
 * The banner carousel is the first visual on every screen size, right after the
 * offer strip. Desktop then still gets the hero + trust badges below it; on phones
 * and tablets those aren't rendered at all, so the carousel leads straight into
 * "Shop by Category" instead.
 *
 * Browsing the full catalogue (with search + category filter) lives on /shop.
 */

// The carousel pulls in the embla-carousel library - loaded as its own chunk so the rest of
// the homepage doesn't wait for it (audit M7). The placeholder reserves the same space.
const BannerCarousel = lazy(() => import("../components/BannerCarousel"));
const bannerPlaceholder = (
  <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4">
    <div className="aspect-[16/9] sm:aspect-[3/1] rounded-2xl bg-cream-dark animate-pulse" />
  </div>
);
export default function Home() {
  // Desktop/laptop only. This is a JS check rather than just Tailwind's `hidden lg:flex`
  // so the hero and its image are genuinely absent from the DOM on smaller screens,
  // not merely hidden (the components keep the CSS guard too, as belt and braces).
  const isDesktop = useMediaQuery(LG_BREAKPOINT);

  const { categories, categoriesLoading, settings } = useAppData();
  const [bestSellers, setBestSellers] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    // Fixed top 12 - never the full catalogue.
    api
      .get("/products/best-sellers", { params: { limit: 12 } })
      .then((res) => setBestSellers(res.data))
      .catch(() => setBestSellers([]))
      .finally(() => setProductsLoading(false));
  }, []);

  const storeName = settings?.storeName || "Ashoka Traders";

  return (
    <div className="bg-cream min-h-screen">
      <Helmet>
        <title>{`${storeName} — Natural Herbs & Dry Fruits`}</title>
        <meta
          name="description"
          content={`${storeName} - premium dry fruits, herbs and everyday essentials delivered across India. Cash on delivery available.`}
        />
      </Helmet>

      <OfferBanner />

      {/* Admin-managed carousel (Admin > Banners) - the very first visual on every
          screen size, right after the offer strip. On mobile (no hero) it leads
          straight into "Shop by Category"; on desktop the hero still follows it. */}
      <Suspense fallback={bannerPlaceholder}>
        <BannerCarousel />
      </Suspense>

      {/* Desktop/laptop only - genuinely absent from the DOM below lg */}
      {isDesktop && (
        <>
          <HeroSection storeName={storeName} />
          <TrustBadges />
        </>
      )}

      <CategorySection categories={categories} loading={categoriesLoading} />

      <section className="max-w-7xl mx-auto px-3 sm:px-4 pb-12">
        <SectionHeading
          title="Best Selling Products"
          linkTo="/shop"
          linkLabel="View All Products"
        />
        <ProductGrid
          products={bestSellers}
          loading={productsLoading}
          skeletonCount={12}
          emptyMessage="No products yet - once the shop adds some, they'll show up here."
          showBestSellerBadge
        />
      </section>
    </div>
  );
}
