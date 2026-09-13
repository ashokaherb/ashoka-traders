const Product = require("../models/Product");
const Category = require("../models/Category");

/**
 * @route   GET /sitemap.xml
 * @desc    Lists the storefront's crawlable URLs (home, category pages, product pages)
 *          for search engines. Uses STOREFRONT_URL from .env to build absolute links -
 *          make sure that's set to the real production domain before going live.
 * @access  Public
 */
const getSitemap = async (req, res) => {
  const baseUrl = (process.env.STOREFRONT_URL || "http://localhost:5173").replace(/\/$/, "");

  const [products, categories] = await Promise.all([
    Product.find({ isActive: true }).select("slug updatedAt"),
    Category.find().select("slug updatedAt"),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${baseUrl}/`, lastmod: today },
    ...categories.map((c) => ({
      loc: `${baseUrl}/category/${c.slug}`,
      lastmod: (c.updatedAt || new Date()).toISOString().slice(0, 10),
    })),
    ...products.map((p) => ({
      loc: `${baseUrl}/product/${p.slug}`,
      lastmod: (p.updatedAt || new Date()).toISOString().slice(0, 10),
    })),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`).join("\n") +
    `\n</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.send(xml);
};

module.exports = { getSitemap };
