const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const h = require("./helpers/harness");

const Product = require("../models/Product");
const Order = require("../models/Order");

let request;
let token;

before(async () => {
  await h.startDb();
  request = supertest(h.getApp());
});
after(h.stopDb);

beforeEach(async () => {
  await h.clearDb();
  await h.makeSettings();
  await h.makeUser({ email: "buyer@test.local" });
  token = await h.login(request, "buyer@test.local");
});

const placeCod = (items) =>
  request.post("/api/orders").set(h.auth(token)).send({ items, address: h.ADDRESS, paymentMethod: "COD" });

describe("inventory", () => {
  test("a COD order deducts exactly the quantity ordered", async () => {
    const product = await h.makeProduct({ price: 200, stock: 5 });
    const res = await placeCod([{ productId: String(product._id), quantity: 3 }]);

    assert.equal(res.status, 201);
    const { stock } = await Product.findById(product._id);
    assert.equal(stock, 2);
  });

  test("ordering more than the stock is refused", async () => {
    const product = await h.makeProduct({ price: 200, stock: 2 });
    const res = await placeCod([{ productId: String(product._id), quantity: 3 }]);

    assert.equal(res.status, 400);
    assert.match(res.body.message, /stock/i);
    assert.equal((await Product.findById(product._id)).stock, 2, "stock untouched");
  });

  test("five simultaneous orders for the last unit: exactly one wins, stock never goes negative", async () => {
    const product = await h.makeProduct({ price: 200, stock: 1 });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => placeCod([{ productId: String(product._id), quantity: 1 }]))
    );

    const created = results.filter((r) => r.status === 201).length;
    assert.equal(created, 1, "only one order succeeded");
    const { stock } = await Product.findById(product._id);
    assert.equal(stock, 0, "stock is 0, never negative");
    assert.equal(await Order.countDocuments(), 1);
  });

  test("a multi-item order rolls back completely if any line is out of stock", async () => {
    const inStock = await h.makeProduct({ name: "Plenty", price: 100, stock: 50 });
    const scarce = await h.makeProduct({ name: "Scarce", price: 100, stock: 1 });

    const res = await placeCod([
      { productId: String(inStock._id), quantity: 2 },
      { productId: String(scarce._id), quantity: 5 },
    ]);

    assert.equal(res.status, 400);
    assert.equal((await Product.findById(inStock._id)).stock, 50, "the first line was not deducted");
    assert.equal((await Product.findById(scarce._id)).stock, 1);
    assert.equal(await Order.countDocuments(), 0);
  });

  test("variant stock is tracked per option", async () => {
    const product = await h.makeProduct({
      name: "Almonds",
      price: 500,
      stock: 0,
      variants: [
        { label: "250g", price: 300, stock: 4 },
        { label: "500g", price: 550, stock: 2 },
      ],
    });
    const variant = product.variants[0];

    const res = await placeCod([{ productId: String(product._id), variantId: String(variant._id), quantity: 3 }]);
    assert.equal(res.status, 201);

    const updated = await Product.findById(product._id);
    assert.equal(updated.variants[0].stock, 1, "the ordered option went 4 -> 1");
    assert.equal(updated.variants[1].stock, 2, "the other option is untouched");
    assert.equal(res.body.items[0].price, 300, "the variant's own price was charged");
  });

  test("concurrent orders cannot oversell a variant", async () => {
    const product = await h.makeProduct({
      name: "Saffron",
      price: 900,
      stock: 0,
      variants: [{ label: "1g", price: 320, stock: 2 }],
    });
    const variantId = String(product.variants[0]._id);

    const results = await Promise.all(
      Array.from({ length: 4 }, () => placeCod([{ productId: String(product._id), variantId, quantity: 1 }]))
    );

    const created = results.filter((r) => r.status === 201).length;
    assert.equal(created, 2, "only the two available units were sold");
    assert.equal((await Product.findById(product._id)).variants[0].stock, 0);
  });

  test("an inactive product cannot be ordered", async () => {
    const product = await h.makeProduct({ price: 100, stock: 10 });
    await Product.updateOne({ _id: product._id }, { isActive: false });

    const res = await placeCod([{ productId: String(product._id), quantity: 1 }]);
    assert.equal(res.status, 400);
    assert.equal(await Order.countDocuments(), 0);
  });
});
