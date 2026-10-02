const Product = require("../models/Product");
const Category = require("../models/Category");

/**
 * Static pages worth indexing, with how often they realistically change.
 * Cart/checkout/account pages are deliberately absent - they are disallowed in robots.txt
 * and listing them would ask Google to crawl what it has been told to skip.
 */
const STATIC_PAGES = [
  { path: "/shop", changefreq: "daily", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/contact", changefreq: "monthly", priority: "0.5" },
  { path: "/shipping", changefreq: "monthly", priority: "0.4" },
  { path: "/returns", changefreq: "monthly", priority: "0.4" },
  { path: "/terms", changefreq: "monthly", priority: "0.3" },
  { path: "/privacy", changefreq: "monthly", priority: "0.3" },
];

/** XML-escapes a URL (&, <, > are illegal raw inside <loc>, and slugs can contain "&"). */
const escapeXml = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const isoDate = (value) => new Date(value || Date.now()).toISOString().slice(0, 10);

/**
 * @route   GET /sitemap.xml
 * @desc    Lists every crawlable storefront URL - homepage, /shop, each category, each
 *          active product and the policy pages - with <lastmod> and <changefreq> so
 *          Google re-crawls products often and static pages rarely.
 *
 *          Products use their own updatedAt, so editing a price or restocking an item
 *          genuinely tells Google the page changed.
 *
 *          Uses STOREFRONT_URL from .env for absolute links - it must be the real
 *          production domain (https://ashokaherbs.com) before launch.
 * @access  Public
 */
const getSitemap = async (req, res) => {
  const baseUrl = (process.env.STOREFRONT_URL || "http://localhost:5173").replace(/\/$/, "");

  const [products, categories] = await Promise.all([
    Product.find({ isActive: true }).select("slug updatedAt").sort({ updatedAt: -1 }),
    Category.find().select("slug updatedAt"),
  ]);

  const today = isoDate();
  const newestProduct = products.length ? isoDate(products[0].updatedAt) : today;

  const urls = [
    // Homepage changes whenever the catalogue or banners do.
    { loc: `${baseUrl}/`, lastmod: newestProduct, changefreq: "daily", priority: "1.0" },
    ...STATIC_PAGES.map((page) => ({
      loc: `${baseUrl}${page.path}`,
      lastmod: page.path === "/shop" ? newestProduct : today,
      changefreq: page.changefreq,
      priority: page.priority,
    })),
    ...categories.map((c) => ({
      loc: `${baseUrl}/category/${c.slug}`,
      lastmod: isoDate(c.updatedAt),
      changefreq: "daily",
      priority: "0.8",
    })),
    ...products.map((p) => ({
      loc: `${baseUrl}/product/${p.slug}`,
      lastmod: isoDate(p.updatedAt),
      changefreq: "daily",
      priority: "0.7",
    })),
  ];

  const body = urls
    .map(
      (u) =>
        `  <url>\n` +
        `    <loc>${escapeXml(u.loc)}</loc>\n` +
        `    <lastmod>${u.lastmod}</lastmod>\n` +
        `    <changefreq>${u.changefreq}</changefreq>\n` +
        `    <priority>${u.priority}</priority>\n` +
        `  </url>`
    )
    .join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  // Cached briefly: crawlers can hit this repeatedly, and it reads the whole catalogue.
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
};

module.exports = { getSitemap };
