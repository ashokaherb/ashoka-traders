import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import api from "../api/axios";
import useMediaQuery, { LG_BREAKPOINT } from "../hooks/useMediaQuery";
import OfferBanner from "../components/OfferBanner";
import HeroSection from "../components/HeroSection";
import TrustBadges from "../components/TrustBadges";
import BannerCarousel from "../components/BannerCarousel";
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
export default function Home() {
  // Desktop/laptop only. This is a JS check rather than just Tailwind's `hidden lg:flex`
  // so the hero and its image are genuinely absent from the DOM on smaller screens,
  // not merely hidden (the components keep the CSS guard too, as belt and braces).
  const isDesktop = useMediaQuery(LG_BREAKPOINT);

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [bestSellers, setBestSellers] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]))
      .finally(() => setCategoriesLoading(false));

    api
      .get("/products/best-sellers", { params: { limit: 12 } })
      .then((res) => setBestSellers(res.data))
      .catch(() => setBestSellers([]))
      .finally(() => setProductsLoading(false));

    api
      .get("/settings")
      .then((res) => setSettings(res.data))
      .catch(() => setSettings(null));
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
      <BannerCarousel />

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
