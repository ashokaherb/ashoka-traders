import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { SITE, OG_IMAGE, absoluteUrl } from "../seo/siteConfig";

/**
 * Every tag a page needs to be indexed properly and to preview well when the link is
 * shared (which for this shop mostly means WhatsApp).
 *
 *   <Seo title="..." description="..." />                 - an ordinary page
 *   <Seo ... image={photo} type="product" />              - a product page
 *   <Seo ... jsonLd={[productSchema(...), crumbs]} />     - plus structured data
 *   <Seo ... noindex />                                   - cart/checkout/account pages
 *
 * The canonical URL is built from the current PATH only, with query strings dropped, so
 * /shop, /shop?search=almond and /shop?page=2 all canonicalise to /shop and can't compete
 * with each other as duplicate content. Pass `canonicalPath` to override that.
 */
export default function Seo({
  title,
  description,
  image = OG_IMAGE,
  type = "website",
  canonicalPath,
  noindex = false,
  jsonLd,
}) {
  const { pathname } = useLocation();
  const canonical = absoluteUrl(canonicalPath || pathname);

  // Accept one schema object or several; skip the nulls the builders return when there
  // isn't enough data for a block.
  const blocks = (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).filter(Boolean);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex ? (
        <meta name="robots" content="noindex, follow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large" />
      )}

      {/* Open Graph - WhatsApp, Facebook, LinkedIn */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content="en_IN" />

      {/* Twitter/X - a large card, same artwork */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {blocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
}
