const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const h = require("./helpers/harness");

const Coupon = require("../models/Coupon");
const Order = require("../models/Order");

let request;
let token;
let product;

before(async () => {
  await h.startDb();
  request = supertest(h.getApp());
});
after(h.stopDb);

beforeEach(async () => {
  await h.clearDb();
  await h.makeSettings();
  product = await h.makeProduct({ price: 500, stock: 100 });
  await h.makeUser({ email: "shopper@test.local" });
  token = await h.login(request, "shopper@test.local");
});

const placeCod = (couponCode, quantity = 2) =>
  request
    .post("/api/orders")
    .set(h.auth(token))
    .send({
      items: [{ productId: String(product._id), quantity }],
      address: h.ADDRESS,
      paymentMethod: "COD",
      couponCode,
    });

describe("coupons", () => {
  test("a percentage coupon discounts the order", async () => {
    await Coupon.create({ code: "SAVE10", discountType: "percent", value: 10 });

    const check = await request.post("/api/coupons/validate").set(h.auth(token)).send({ code: "save10", subtotal: 1000 });
    assert.equal(check.status, 200);
    assert.equal(check.body.discount, 100, "lowercase codes work too");

    const order = await placeCod("SAVE10");
    assert.equal(order.status, 201);
    assert.equal(order.body.discount, 100);
    assert.equal(order.body.total, 900, "1000 - 100 discount, free shipping at 1000");
  });

  test("a flat coupon discounts the order", async () => {
    await Coupon.create({ code: "FLAT50", discountType: "flat", value: 50 });
    const order = await placeCod("FLAT50");
    assert.equal(order.body.discount, 50);
  });

  test("an expired coupon is refused", async () => {
    await Coupon.create({ code: "OLD", discountType: "percent", value: 10, expiryDate: new Date(Date.now() - 86400000) });
    const res = await placeCod("OLD");
    assert.equal(res.status, 400);
    assert.match(res.body.message, /expired/i);
    assert.equal(await Order.countDocuments(), 0);
  });

  test("an inactive coupon is refused", async () => {
    await Coupon.create({ code: "OFF", discountType: "percent", value: 10, active: false });
    const res = await placeCod("OFF");
    assert.equal(res.status, 400);
  });

  test("a coupon below its minimum order value is refused", async () => {
    await Coupon.create({ code: "BIG", discountType: "flat", value: 100, minOrderValue: 5000 });
    const res = await placeCod("BIG");
    assert.equal(res.status, 400);
    assert.match(res.body.message, /minimum order/i);
    assert.equal(await Order.countDocuments(), 0);
  });

  test("usage limit: the second order with a 1-use coupon is refused", async () => {
    await Coupon.create({ code: "ONCE", discountType: "flat", value: 50, usageLimit: 1 });

    const first = await placeCod("ONCE");
    const second = await placeCod("ONCE");

    assert.equal(first.status, 201);
    assert.equal(second.status, 400);
    assert.match(second.body.message, /usage limit/i);
    assert.equal((await Coupon.findOne({ code: "ONCE" })).usedCount, 1);
  });

  test("concurrent orders cannot exceed the usage limit", async () => {
    await Coupon.create({ code: "RACE", discountType: "flat", value: 50, usageLimit: 2 });

    const results = await Promise.all(Array.from({ length: 6 }, () => placeCod("RACE")));
    const created = results.filter((r) => r.status === 201).length;

    assert.equal(created, 2, "only two uses were allowed");
    assert.equal((await Coupon.findOne({ code: "RACE" })).usedCount, 2);
  });

  test("checking a coupon does not count as a use", async () => {
    await Coupon.create({ code: "PEEK", discountType: "percent", value: 10, usageLimit: 1 });

    await request.post("/api/coupons/validate").set(h.auth(token)).send({ code: "PEEK", subtotal: 1000 });
    await request.post("/api/coupons/validate").set(h.auth(token)).send({ code: "PEEK", subtotal: 1000 });

    assert.equal((await Coupon.findOne({ code: "PEEK" })).usedCount, 0);
    const order = await placeCod("PEEK");
    assert.equal(order.status, 201, "the coupon is still usable");
  });

  test("an unknown coupon code is refused", async () => {
    const res = await placeCod("DOESNOTEXIST");
    assert.equal(res.status, 400);
  });

  test("the available-coupons list hides what the cart cannot use", async () => {
    await Coupon.create({ code: "NOW", discountType: "percent", value: 5 });
    await Coupon.create({ code: "LATER", discountType: "flat", value: 100, minOrderValue: 5000 });
    await Coupon.create({ code: "GONE", discountType: "flat", value: 10, usageLimit: 1, usedCount: 1 });

    const res = await request.get("/api/coupons/available?subtotal=1000").set(h.auth(token));
    assert.equal(res.status, 200);
    const byCode = Object.fromEntries(res.body.map((c) => [c.code, c]));

    assert.equal(byCode.NOW.eligible, true);
    assert.equal(byCode.LATER.eligible, false);
    assert.equal(byCode.LATER.shortBy, 4000, "it says how much more is needed");
    assert.equal(byCode.GONE, undefined, "a used-up coupon is not offered at all");
  });

  test("the discount can never exceed the subtotal", async () => {
    await Coupon.create({ code: "HUGE", discountType: "flat", value: 99999 });
    const order = await placeCod("HUGE", 1);
    assert.equal(order.status, 201);
    assert.ok(order.body.total >= 0, "the total never goes negative");
    assert.equal(order.body.discount, 500, "capped at the 500 subtotal");
  });
});
