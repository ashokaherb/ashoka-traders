/**
 * Builders for the JSON-LD (schema.org) blocks the storefront emits.
 *
 * Rules these follow, because Google penalises structured data that disagrees with the
 * page:
 *   - every value comes from the real product/category/settings document - never a
 *     hardcoded sample;
 *   - a field we don't have is left out entirely rather than guessed;
 *   - no Review / AggregateRating is emitted. The catalogue has rating fields, but there
 *     is no customer review feature, so those numbers are shop-entered display values.
 *     Marking them up as review data would breach Google's structured-data policy.
 *
 * Validate changes with https://search.google.com/test/rich-results.
 */
import { SITE, SITE_URL, LOGO_URL, absoluteUrl } from "./siteConfig";

/** Drops keys whose value is empty/undefined, so no blank fields reach the markup. */
const compact = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length))
  );

const postalAddress = () => {
  const a = SITE.address;
  return compact({
    "@type": "PostalAddress",
    streetAddress: a.street,
    addressLocality: a.city,
    addressRegion: a.state,
    postalCode: a.postalCode,
    addressCountry: a.country,
  });
};

/**
 * Organization - the business itself. Emitted once, on the homepage.
 * Contact details come from admin Settings so they can never contradict the footer.
 */
export const organizationSchema = (rawSettings) => {
  const settings = rawSettings || {};
  return compact({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: settings.storeName || SITE.name,
    url: SITE_URL,
    logo: LOGO_URL,
    description: SITE.description,
    address: postalAddress(),
    email: settings.supportEmail || undefined,
    telephone: settings.supportPhone || undefined,
    sameAs: SITE.socialProfiles,
  });
};

/**
 * LocalBusiness - the physical shop, for local/map-pack visibility alongside the
 * Google Business Profile. Opening hours are deliberately omitted: the repository has no
 * record of them, and wrong hours on a shopfront listing is worse than none.
 * CLIENT TODO: supply opening hours and geo co-ordinates to strengthen this.
 */
export const localBusinessSchema = (rawSettings) => {
  const settings = rawSettings || {};
  return compact({
    "@context": "https://schema.org",
    "@type": "GroceryStore",
    "@id": `${SITE_URL}/#localbusiness`,
    name: settings.storeName || SITE.name,
    url: SITE_URL,
    image: LOGO_URL,
    description: SITE.description,
    address: postalAddress(),
    telephone: settings.supportPhone || undefined,
    email: settings.supportEmail || undefined,
    priceRange: "₹₹",
    currenciesAccepted: "INR",
    paymentAccepted: "Cash on Delivery, UPI, Credit Card, Debit Card, Net Banking",
    areaServed: "IN",
    sameAs: SITE.socialProfiles,
  });
};

/**
 * Product - the highest-impact block on the site (price + availability can show
 * directly in search results). Availability is the product's ACTUAL stock, including the
 * selected variant's, so the markup matches the Add to Cart button's real state.
 */
export const productSchema = (product, { price, stock, settings } = {}) => {
  if (!product) return null;
  const store = (settings || {}).storeName || SITE.name;
  const url = absoluteUrl(`/product/${product.slug}`);
  const inStock = Number(stock) > 0;
  return compact({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url,
    image: product.images?.length ? product.images : undefined,
    description: product.description || `Buy ${product.name} online at ${SITE.name}.`,
    // No per-product SKU field exists in the catalogue, so the slug - which is unique and
    // stable - is used as the identifier rather than inventing a code.
    sku: product.slug,
    brand: { "@type": "Brand", name: store },
    category: product.category?.name || undefined,
    offers: compact({
      "@type": "Offer",
      url,
      price: Number(price).toFixed(2),
      priceCurrency: "INR",
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: store },
    }),
  });
};

/**
 * BreadcrumbList - must mirror the breadcrumb trail the visitor can see, so this takes
 * the very same array the <Breadcrumbs> component renders.
 * @param {{name: string, path?: string}[]} trail
 */
export const breadcrumbSchema = (trail = []) => {
  if (trail.length < 2) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) =>
      compact({
        "@type": "ListItem",
        position: i + 1,
        name: crumb.name,
        item: crumb.path ? absoluteUrl(crumb.path) : undefined,
      })
    ),
  };
};

/** WebSite + SearchAction, so Google can offer a sitelinks search box. */
export const websiteSchema = (settings) => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: (settings || {}).storeName || SITE.name,
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/shop?search={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
});
