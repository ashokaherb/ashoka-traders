const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const h = require("./helpers/harness");

const Coupon = require("../models/Coupon");
const Product = require("../models/Product");

let request;
let token;
let adminToken;

before(async () => {
  await h.startDb();
  request = supertest(h.getApp());
});
after(h.stopDb);

beforeEach(async () => {
  await h.clearDb();
  await h.makeSettings();
  await h.makeUser({ email: "user@test.local" });
  await h.makeAdmin();
  token = await h.login(request, "user@test.local");
  adminToken = await h.login(request, "admin@test.local");
});

describe("security", () => {
  test("NoSQL operators in a query string cannot bypass a filter", async () => {
    const category = await (await h.makeProduct({ name: "In category", stock: 5 })).populate("category");
    await h.makeProduct({ name: "Another", stock: 5 });

    const all = await request.get("/api/products");
    assert.ok(all.body.totalCount >= 2);

    const injected = await request.get("/api/products?category[$ne]=000000000000000000000000");
    assert.equal(injected.status, 400, "the malformed filter is rejected, not silently ignored");

    const legit = await request.get(`/api/products?category=${category.category._id}`);
    assert.equal(legit.status, 200, "a real category filter still works");
  });

  test("NoSQL operators in a login body cannot match the first user", async () => {
    const res = await request.post("/api/auth/login").send({ email: { $gt: "" }, password: h.PASSWORD });
    assert.equal(res.status, 400);
    assert.equal(res.body.token, undefined, "no session is handed out");
  });

  test("operator keys are stripped from request bodies", async () => {
    const res = await request
      .post("/api/auth/register")
      .send({ name: "X", email: { $gt: "" }, password: "secret12" });
    assert.equal(res.status, 400);
  });

  test("unexpected fields are ignored instead of being saved (mass assignment)", async () => {
    const res = await request
      .post("/api/auth/register")
      .send({ name: "Sneaky", email: "sneaky@test.local", password: "secret12", isAdmin: true });

    assert.equal(res.status, 201);
    assert.equal(res.body.isAdmin, false, "isAdmin cannot be set from the request");
  });

  test("a coupon update cannot rewrite usedCount or _id", async () => {
    const coupon = await Coupon.create({ code: "KEEP", discountType: "flat", value: 50, usageLimit: 10, usedCount: 7 });

    const res = await request
      .put(`/api/coupons/${coupon._id}`)
      .set(h.auth(adminToken))
      .send({ value: 60, usedCount: 0, _id: "000000000000000000000000", hacked: "yes" });

    assert.equal(res.status, 200);
    const after = await Coupon.findById(coupon._id).lean();
    assert.equal(after.value, 60, "the legitimate change applied");
    assert.equal(after.usedCount, 7, "the usage counter was not reset");
    assert.equal(after.hacked, undefined, "unknown fields are dropped");
  });

  test("admin-only routes refuse customers and anonymous callers", async () => {
    const adminRoutes = [
      ["get", "/api/dashboard"],
      ["get", "/api/orders"],
      ["get", "/api/coupons"],
      ["post", "/api/products"],
      ["get", "/api/orders/export"],
    ];

    for (const [method, path] of adminRoutes) {
      const anon = await request[method](path);
      assert.equal(anon.status, 401, `${path} needs a login`);
      const customer = await request[method](path).set(h.auth(token));
      assert.equal(customer.status, 403, `${path} needs an admin`);
    }
  });

  test("invalid input is rejected with a readable message", async () => {
    const res = await request
      .post("/api/orders")
      .set(h.auth(token))
      .send({
        items: [{ productId: String((await h.makeProduct())._id), quantity: 0 }],
        address: { ...h.ADDRESS, pincode: "12", phone: "123" },
        paymentMethod: "COD",
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.message.length > 0);
    assert.ok(Array.isArray(res.body.fields), "the failing fields are named");
  });

  test("a product cannot be created with a non-numeric price", async () => {
    const product = await h.makeProduct();
    const res = await request
      .post("/api/products")
      .set(h.auth(adminToken))
      .send({ name: "Bad", price: "abc", category: String(product.category) });
    assert.equal(res.status, 400);
  });

  test("repeated failed logins are rate limited", async () => {
    await h.makeUser({ email: "target@test.local" });
    const attempt = () => request.post("/api/auth/login").send({ email: "target@test.local", password: "wrong-one" });

    const statuses = [];
    for (let i = 0; i < 7; i++) statuses.push((await attempt()).status);

    assert.ok(statuses.includes(429), `expected a 429 among ${statuses.join(",")}`);
    const blocked = await attempt();
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.code, "RATE_LIMITED");
  });

  test("the API never returns password hashes", async () => {
    const res = await request.get("/api/auth/me").set(h.auth(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.password, undefined);
  });

  test("unknown routes return a JSON 404", async () => {
    const res = await request.get("/api/does-not-exist");
    assert.equal(res.status, 404);
    assert.match(res.body.message, /not found/i);
  });

  test("a deleted user's token stops working", async () => {
    const victim = await h.makeUser({ email: "gone@test.local" });
    const victimToken = await h.login(request, "gone@test.local");
    await require("../models/User").deleteOne({ _id: victim._id });

    const res = await request.get("/api/auth/me").set(h.auth(victimToken));
    assert.equal(res.status, 401);
  });

  test("product stock cannot be edited by a customer", async () => {
    const product = await h.makeProduct({ stock: 5 });
    const res = await request.put(`/api/products/${product._id}`).set(h.auth(token)).send({ stock: 9999 });
    assert.equal(res.status, 403);
    assert.equal((await Product.findById(product._id)).stock, 5);
  });
});
