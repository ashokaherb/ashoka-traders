const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const supertest = require("supertest");
const h = require("./helpers/harness");

const PaymentIntent = require("../models/PaymentIntent");
const Order = require("../models/Order");
const razorpay = require("../utils/razorpay");

let request;
let product;
let token;

/** Stubs Razorpay's API so no network call is made and each test controls the answers. */
function stubRazorpay({ orderId = "order_TEST1", payment } = {}) {
  razorpay.orders.create = async ({ amount, currency }) => ({ id: orderId, amount, currency: currency || "INR" });
  razorpay.payments.fetch = async (id) => ({
    id,
    order_id: orderId,
    amount: payment?.amount,
    currency: payment?.currency ?? "INR",
    status: payment?.status ?? "captured",
    ...payment,
  });
}

const signature = (orderId, paymentId) =>
  crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

before(async () => {
  await h.startDb();
  request = supertest(h.getApp());
});
after(h.stopDb);

beforeEach(async () => {
  await h.clearDb();
  await h.makeSettings();
  product = await h.makeProduct({ price: 500, stock: 10 });
  await h.makeUser({ email: "payer@test.local" });
  token = await h.login(request, "payer@test.local");
});

const createRazorpayOrder = (items) =>
  request
    .post("/api/orders/razorpay")
    .set(h.auth(token))
    .send({ items: items || [{ productId: String(product._id), quantity: 2 }], address: h.ADDRESS });

describe("razorpay payment verification", () => {
  test("the amount comes from the server, not the client", async () => {
    stubRazorpay();
    const res = await createRazorpayOrder();
    assert.equal(res.status, 200);
    // 2 x 500 = 1000 subtotal -> free shipping at 1000 -> 100000 paise
    assert.equal(res.body.amount, 100000);

    const intent = await PaymentIntent.findOne({ razorpayOrderId: res.body.razorpayOrderId });
    assert.equal(intent.amountPaise, 100000);
    assert.equal(intent.total, 1000, "the stored total is the server's own calculation");
    assert.ok(intent.address, "the address is stored so the webhook can finish the order");
  });

  test("a client-sent price is ignored entirely", async () => {
    stubRazorpay();
    const res = await request
      .post("/api/orders/razorpay")
      .set(h.auth(token))
      .send({ items: [{ productId: String(product._id), quantity: 1, price: 1, total: 1 }], address: h.ADDRESS });
    assert.equal(res.status, 200);
    assert.equal(res.body.amount, 54900, "500 + 49 shipping, not the 1 rupee the client asked for");
  });

  test("an invalid signature is refused and no order is created", async () => {
    stubRazorpay({ payment: { amount: 100000 } });
    const created = await createRazorpayOrder();
    const res = await request
      .post("/api/orders/razorpay/verify")
      .set(h.auth(token))
      .send({
        razorpay_order_id: created.body.razorpayOrderId,
        razorpay_payment_id: "pay_TEST1",
        razorpay_signature: "deadbeef",
        items: [{ productId: String(product._id), quantity: 2 }],
        address: h.ADDRESS,
      });
    assert.equal(res.status, 400);
    assert.equal(await Order.countDocuments(), 0);
  });

  test("a valid payment creates exactly one order and deducts stock", async () => {
    stubRazorpay({ payment: { amount: 100000 } });
    const created = await createRazorpayOrder();
    const orderId = created.body.razorpayOrderId;

    const res = await request
      .post("/api/orders/razorpay/verify")
      .set(h.auth(token))
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: "pay_OK",
        razorpay_signature: signature(orderId, "pay_OK"),
        items: [{ productId: String(product._id), quantity: 2 }],
        address: h.ADDRESS,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.paymentStatus, "paid");
    assert.equal(res.body.total, 1000);
    assert.ok(res.body.billNumber, "a bill number is assigned");
    assert.equal(await Order.countDocuments(), 1);

    const { stock } = await require("../models/Product").findById(product._id);
    assert.equal(stock, 8, "stock went 10 -> 8");
    const intent = await PaymentIntent.findOne({ razorpayOrderId: orderId });
    assert.equal(intent.status, "consumed");
  });

  test("replaying the same payment does not create a second order", async () => {
    stubRazorpay({ payment: { amount: 100000 } });
    const created = await createRazorpayOrder();
    const orderId = created.body.razorpayOrderId;
    const body = {
      razorpay_order_id: orderId,
      razorpay_payment_id: "pay_REPLAY",
      razorpay_signature: signature(orderId, "pay_REPLAY"),
      items: [{ productId: String(product._id), quantity: 2 }],
      address: h.ADDRESS,
    };

    const first = await request.post("/api/orders/razorpay/verify").set(h.auth(token)).send(body);
    const second = await request.post("/api/orders/razorpay/verify").set(h.auth(token)).send(body);

    assert.equal(first.status, 201);
    assert.equal(second.status, 409);
    assert.equal(await Order.countDocuments(), 1, "still exactly one order");
  });

  test("a payment worth less than the order is refused and flagged", async () => {
    stubRazorpay({ payment: { amount: 100 } }); // Razorpay says 1 rupee was paid
    const created = await createRazorpayOrder();
    const orderId = created.body.razorpayOrderId;

    const res = await request
      .post("/api/orders/razorpay/verify")
      .set(h.auth(token))
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: "pay_SHORT",
        razorpay_signature: signature(orderId, "pay_SHORT"),
        items: [{ productId: String(product._id), quantity: 2 }],
        address: h.ADDRESS,
      });

    assert.equal(res.status, 400);
    assert.equal(await Order.countDocuments(), 0);
    const intent = await PaymentIntent.findOne({ razorpayOrderId: orderId });
    assert.equal(intent.status, "flagged");
  });

  test("a payment in another currency is refused", async () => {
    stubRazorpay({ payment: { amount: 100000, currency: "USD" } });
    const created = await createRazorpayOrder();
    const orderId = created.body.razorpayOrderId;

    const res = await request
      .post("/api/orders/razorpay/verify")
      .set(h.auth(token))
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: "pay_USD",
        razorpay_signature: signature(orderId, "pay_USD"),
        items: [{ productId: String(product._id), quantity: 2 }],
        address: h.ADDRESS,
      });
    assert.equal(res.status, 400);
    assert.equal(await Order.countDocuments(), 0);
  });

  test("another customer cannot claim someone else's payment", async () => {
    stubRazorpay({ payment: { amount: 100000 } });
    const created = await createRazorpayOrder();
    const orderId = created.body.razorpayOrderId;

    await h.makeUser({ email: "thief@test.local" });
    const thiefToken = await h.login(request, "thief@test.local");

    const res = await request
      .post("/api/orders/razorpay/verify")
      .set(h.auth(thiefToken))
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: "pay_THIEF",
        razorpay_signature: signature(orderId, "pay_THIEF"),
        items: [{ productId: String(product._id), quantity: 2 }],
        address: h.ADDRESS,
      });

    assert.equal(res.status, 403);
    assert.equal(await Order.countDocuments(), 0);
  });

  test("a cart that differs from the one paid for is refused", async () => {
    stubRazorpay({ payment: { amount: 100000 } });
    const created = await createRazorpayOrder();
    const orderId = created.body.razorpayOrderId;
    const extra = await h.makeProduct({ name: "Sneaked In", price: 900, stock: 5 });

    const res = await request
      .post("/api/orders/razorpay/verify")
      .set(h.auth(token))
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: "pay_SWAP",
        razorpay_signature: signature(orderId, "pay_SWAP"),
        items: [{ productId: String(extra._id), quantity: 5 }],
        address: h.ADDRESS,
      });

    assert.equal(res.status, 400);
    assert.equal(await Order.countDocuments(), 0);
  });

  test("an unpaid (created) Razorpay payment is refused", async () => {
    stubRazorpay({ payment: { amount: 100000, status: "created" } });
    const created = await createRazorpayOrder();
    const orderId = created.body.razorpayOrderId;

    const res = await request
      .post("/api/orders/razorpay/verify")
      .set(h.auth(token))
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: "pay_UNPAID",
        razorpay_signature: signature(orderId, "pay_UNPAID"),
        items: [{ productId: String(product._id), quantity: 2 }],
        address: h.ADDRESS,
      });
    assert.equal(res.status, 400);
    assert.equal(await Order.countDocuments(), 0);
  });

  test("an item that sells out after payment creates a refund_requested order, not a failure", async () => {
    stubRazorpay({ payment: { amount: 100000 } });
    const created = await createRazorpayOrder();
    const orderId = created.body.razorpayOrderId;

    // Everything sells out while the customer is on Razorpay's payment page.
    await require("../models/Product").updateOne({ _id: product._id }, { stock: 0 });

    const res = await request
      .post("/api/orders/razorpay/verify")
      .set(h.auth(token))
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: "pay_SOLDOUT",
        razorpay_signature: signature(orderId, "pay_SOLDOUT"),
        items: [{ productId: String(product._id), quantity: 2 }],
        address: h.ADDRESS,
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.refundPending, true);
    const order = await Order.findById(res.body.orderId);
    assert.equal(order.paymentStatus, "refund_requested");
    assert.equal(order.orderStatus, "Cancelled");
    const { stock } = await require("../models/Product").findById(product._id);
    assert.equal(stock, 0, "no stock was taken");
  });
});
