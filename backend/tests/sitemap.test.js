const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const h = require("./helpers/harness");

const Product = require("../models/Product");

let request;

before(async () => {
  await h.startDb();
  request = supertest(h.getApp());
  // The controller builds absolute URLs from this - it is what Google will be given.
  process.env.STOREFRONT_URL = "https://ashokaherbs.com";
});
after(h.stopDb);

beforeEach(h.clearDb);

const getSitemap = () => request.get("/sitemap.xml");

describe("sitemap.xml", () => {
  test("is public, XML, and well formed", async () => {
    const res = await getSitemap();
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /xml/);
    assert.match(res.text, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.ok(res.text.trim().endsWith("</urlset>"));
    // Every opened tag is closed - a malformed sitemap is rejected wholesale by Google.
    for (const tag of ["url", "loc", "lastmod", "changefreq", "priority"]) {
      const opens = (res.text.match(new RegExp(`<${tag}>`, "g")) || []).length;
      const closes = (res.text.match(new RegExp(`</${tag}>`, "g")) || []).length;
      assert.equal(opens, closes, `unbalanced <${tag}>`);
    }
  });

  test("lists the homepage and every static page worth indexing", async () => {
    const { text } = await getSitemap();
    for (const path of ["/", "/shop", "/about", "/contact", "/shipping", "/returns", "/terms", "/privacy"]) {
      assert.ok(text.includes(`<loc>https://ashokaherbs.com${path}</loc>`), `missing ${path}`);
    }
  });

  test("never lists the pages robots.txt disallows", async () => {
    const { text } = await getSitemap();
    for (const path of ["/cart", "/checkout", "/login", "/register", "/profile", "/my-orders", "/wishlist"]) {
      assert.ok(!text.includes(`${path}</loc>`), `${path} should not be in the sitemap`);
    }
  });

  test("lists active products and categories by slug, but not hidden products", async () => {
    await h.makeProduct({ name: "Premium Almonds" });
    const hidden = await h.makeProduct({ name: "Discontinued Mix" });
    await Product.updateOne({ _id: hidden._id }, { isActive: false });

    const { text } = await getSitemap();
    assert.ok(text.includes("<loc>https://ashokaherbs.com/product/premium-almonds</loc>"));
    assert.ok(!text.includes("discontinued-mix"), "an inactive product must not be offered to Google");
    assert.ok(text.includes("<loc>https://ashokaherbs.com/category/dry-fruits</loc>"));
  });

  test("a product's lastmod is its own updatedAt, so an edit asks for a re-crawl", async () => {
    const product = await h.makeProduct({ name: "Kashmiri Walnuts" });
    const backdated = new Date("2026-01-15T00:00:00Z");
    await Product.collection.updateOne({ _id: product._id }, { $set: { updatedAt: backdated } });

    const { text } = await getSitemap();
    const block = text.split("<url>").find((u) => u.includes("kashmiri-walnuts"));
    assert.ok(block.includes("<lastmod>2026-01-15</lastmod>"), block);
  });

  test("products are crawled often, policy pages rarely", async () => {
    await h.makeProduct({ name: "Himalayan Shilajit" });
    const { text } = await getSitemap();
    const blockFor = (slug) => text.split("<url>").find((u) => u.includes(slug));
    assert.match(blockFor("/product/himalayan-shilajit"), /<changefreq>daily<\/changefreq>/);
    assert.match(blockFor("/terms"), /<changefreq>monthly<\/changefreq>/);
    assert.match(blockFor("<loc>https://ashokaherbs.com/</loc>"), /<priority>1\.0<\/priority>/);
  });

  test("every lastmod is a valid ISO date", async () => {
    await h.makeProduct({ name: "Organic Turmeric" });
    const { text } = await getSitemap();
    const dates = [...text.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
    assert.ok(dates.length > 5);
    for (const d of dates) {
      assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(!Number.isNaN(Date.parse(d)));
    }
  });
});
