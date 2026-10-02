const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const h = require("./helpers/harness");

const Order = require("../models/Order");

let request;
let token;
let adminToken;
let product;

before(async () => {
  await h.startDb();
  request = supertest(h.getApp());
});
after(h.stopDb);

beforeEach(async () => {
  await h.clearDb();
  await h.makeSettings();
  product = await h.makeProduct({ price: 300, stock: 50 });
  await h.makeUser({ email: "customer@test.local" });
  await h.makeAdmin();
  token = await h.login(request, "customer@test.local");
  adminToken = await h.login(request, "admin@test.local");
});

const placeCod = (quantity = 1) =>
  request
    .post("/api/orders")
    .set(h.auth(token))
    .send({ items: [{ productId: String(product._id), quantity }], address: h.ADDRESS, paymentMethod: "COD" });

describe("orders", () => {
  test("a COD order is created with server-calculated totals and a bill number", async () => {
    const res = await placeCod(2);
    assert.equal(res.status, 201);
    assert.equal(res.body.subtotal, 600);
    assert.equal(res.body.shippingFee, 49, "below the free-shipping threshold");
    assert.equal(res.body.total, 649);
    assert.equal(res.body.paymentMethod, "COD");
    assert.equal(res.body.paymentStatus, "pending");
    assert.match(res.body.billNumber, /^AT\/\d{2}-\d{2}\/\d{4}$/);
  });

  test("bill numbers are consecutive and never reused", async () => {
    const first = await placeCod();
    const second = await placeCod();
    assert.notEqual(first.body.billNumber, second.body.billNumber);
    const numbers = [first.body.billNumber, second.body.billNumber].map((b) => Number(b.split("/")[2]));
    assert.equal(numbers[1], numbers[0] + 1);
  });

  test("free shipping applies at the configured threshold", async () => {
    const res = await placeCod(4); // 1200 >= 1000
    assert.equal(res.body.shippingFee, 0);
  });

  test("a minimum order value is enforced server-side", async () => {
    await h.makeSettings({ minimumOrderValue: 1000 });
    const res = await placeCod(1); // 300 only
    assert.equal(res.status, 400);
    assert.match(res.body.message, /minimum order/i);
  });

  test("the online-payment route refuses a COD payload", async () => {
    const res = await request
      .post("/api/orders")
      .set(h.auth(token))
      .send({ items: [{ productId: String(product._id), quantity: 1 }], address: h.ADDRESS, paymentMethod: "Razorpay" });
    assert.equal(res.status, 400);
  });

  test("My Orders returns only the caller's own orders, paginated", async () => {
    await placeCod();
    await placeCod();

    await h.makeUser({ email: "other@test.local" });
    const otherToken = await h.login(request, "other@test.local");
    await request
      .post("/api/orders")
      .set(h.auth(otherToken))
      .send({ items: [{ productId: String(product._id), quantity: 1 }], address: h.ADDRESS, paymentMethod: "COD" });

    const mine = await request.get("/api/orders/my").set(h.auth(token));
    assert.equal(mine.status, 200);
    assert.equal(mine.body.totalCount, 2, "only my two orders");
    assert.equal(mine.body.page, 1);
    assert.ok(Array.isArray(mine.body.data));
  });

  test("a customer cannot read someone else's order", async () => {
    const mine = await placeCod();
    await h.makeUser({ email: "nosy@test.local" });
    const nosyToken = await h.login(request, "nosy@test.local");

    const res = await request.get(`/api/orders/${mine.body._id}`).set(h.auth(nosyToken));
    assert.equal(res.status, 403);
  });

  test("an admin can read any order", async () => {
    const mine = await placeCod();
    const res = await request.get(`/api/orders/${mine.body._id}`).set(h.auth(adminToken));
    assert.equal(res.status, 200);
  });

  test("a customer cannot change an order's status", async () => {
    const mine = await placeCod();
    const res = await request.put(`/api/orders/${mine.body._id}/status`).set(h.auth(token)).send({ orderStatus: "Delivered" });
    assert.equal(res.status, 403);
  });

  test("valid status transitions are allowed in order", async () => {
    const mine = await placeCod();
    for (const next of ["Packed", "Shipped", "Delivered"]) {
      const res = await request.put(`/api/orders/${mine.body._id}/status`).set(h.auth(adminToken)).send({ orderStatus: next });
      assert.equal(res.status, 200, `Placed..->${next}`);
      assert.equal(res.body.orderStatus, next);
    }
  });

  test("invalid status transitions are refused with a clear message", async () => {
    const mine = await placeCod();
    const id = mine.body._id;

    const skip = await request.put(`/api/orders/${id}/status`).set(h.auth(adminToken)).send({ orderStatus: "Delivered" });
    assert.equal(skip.status, 400);
    assert.match(skip.body.message, /Cannot move from Placed to Delivered/);

    await Order.updateOne({ _id: id }, { orderStatus: "Delivered" });
    const back = await request.put(`/api/orders/${id}/status`).set(h.auth(adminToken)).send({ orderStatus: "Placed" });
    assert.equal(back.status, 400);
    assert.match(back.body.message, /Delivered is final/);

    await Order.updateOne({ _id: id }, { orderStatus: "Cancelled" });
    const resurrect = await request.put(`/api/orders/${id}/status`).set(h.auth(adminToken)).send({ orderStatus: "Shipped" });
    assert.equal(resurrect.status, 400);
  });

  test("an unknown status value is rejected by validation", async () => {
    const mine = await placeCod();
    const res = await request.put(`/api/orders/${mine.body._id}/status`).set(h.auth(adminToken)).send({ orderStatus: "Lost" });
    assert.equal(res.status, 400);
  });

  test("the admin CSV export neutralises spreadsheet formulas", async () => {
    await h.makeUser({ email: "evil@test.local", name: '=HYPERLINK("http://evil.test","click")' });
    const evilToken = await h.login(request, "evil@test.local");
    await request
      .post("/api/orders")
      .set(h.auth(evilToken))
      .send({ items: [{ productId: String(product._id), quantity: 1 }], address: h.ADDRESS, paymentMethod: "COD" });

    const res = await request.get("/api/orders/export").set(h.auth(adminToken));
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /text\/csv/);
    assert.ok(res.text.includes(`"'=HYPERLINK`), "the formula is prefixed with a quote so Excel treats it as text");
  });

  test("the export rejects a malformed date filter", async () => {
    const res = await request.get("/api/orders/export?startDate=not-a-date").set(h.auth(adminToken));
    assert.equal(res.status, 400);
  });
});
