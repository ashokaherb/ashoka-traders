const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const supertest = require("supertest");
const h = require("./helpers/harness");

const PaymentIntent = require("../models/PaymentIntent");
const Order = require("../models/Order");
const Product = require("../models/Product");
const razorpay = require("../utils/razorpay");

let request;
let product;
let token;

const WEBHOOK_SECRET = "test_webhook_secret";

const paymentCapturedEvent = ({ paymentId = "pay_HOOK", orderId, amount, currency = "INR" }) =>
  JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: paymentId, order_id: orderId, amount, currency, status: "captured" } } },
  });

const sign = (body, secret = WEBHOOK_SECRET) => crypto.createHmac("sha256", secret).update(body).digest("hex");

const postWebhook = (body, signature) =>
  request
    .post("/api/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set("x-razorpay-signature", signature ?? sign(body))
    .send(body);

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
  razorpay.orders.create = async ({ amount, currency }) => ({ id: "order_HOOK", amount, currency });
});

/** Creates a payment session exactly as checkout does, and returns the stored intent. */
async function startPayment(quantity = 2) {
  const res = await request
    .post("/api/orders/razorpay")
    .set(h.auth(token))
    .send({ items: [{ productId: String(product._id), quantity }], address: h.ADDRESS });
  return PaymentIntent.findOne({ razorpayOrderId: res.body.razorpayOrderId });
}

describe("razorpay webhook", () => {
  test("rejects a wrong signature and creates nothing", async () => {
    const intent = await startPayment();
    const body = paymentCapturedEvent({ orderId: intent.razorpayOrderId, amount: intent.amountPaise });

    const res = await postWebhook(body, sign(body, "the-wrong-secret"));
    assert.equal(res.status, 400);
    assert.equal(await Order.countDocuments(), 0);
  });

  test("rejects a missing signature", async () => {
    const intent = await startPayment();
    const body = paymentCapturedEvent({ orderId: intent.razorpayOrderId, amount: intent.amountPaise });
    const res = await request.post("/api/webhooks/razorpay").set("Content-Type", "application/json").send(body);
    assert.equal(res.status, 400);
  });

  test("a valid payment.captured creates the order the browser never confirmed", async () => {
    const intent = await startPayment();
    const body = paymentCapturedEvent({ orderId: intent.razorpayOrderId, amount: intent.amountPaise });

    const res = await postWebhook(body);
    assert.equal(res.status, 200);
    assert.equal(res.body.handled, true);
    assert.equal(res.body.outcome, "created");

    const order = await Order.findOne({ razorpayPaymentId: "pay_HOOK" });
    assert.ok(order, "the order exists");
    assert.equal(order.paymentStatus, "paid");
    assert.equal(order.total, intent.total);
    assert.equal(order.address.pincode, h.ADDRESS.pincode, "it used the address stored on the payment session");
    assert.ok(order.billNumber);

    const { stock } = await Product.findById(product._id);
    assert.equal(stock, 8, "stock was deducted once");
    assert.equal((await PaymentIntent.findById(intent._id)).status, "consumed");
  });

  test("is idempotent - a duplicate delivery does not create a second order", async () => {
    const intent = await startPayment();
    const body = paymentCapturedEvent({ orderId: intent.razorpayOrderId, amount: intent.amountPaise });

    const first = await postWebhook(body);
    const second = await postWebhook(body);
    const third = await postWebhook(body);

    assert.equal(first.body.handled, true);
    assert.equal(second.status, 200);
    assert.equal(second.body.handled, false);
    assert.equal(third.body.handled, false);
    assert.equal(await Order.countDocuments(), 1, "exactly one order");
    const { stock } = await Product.findById(product._id);
    assert.equal(stock, 8, "stock deducted only once");
  });

  test("does nothing when the browser already created the order", async () => {
    const intent = await startPayment();
    razorpay.payments.fetch = async (id) => ({
      id,
      order_id: intent.razorpayOrderId,
      amount: intent.amountPaise,
      currency: "INR",
      status: "captured",
    });
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${intent.razorpayOrderId}|pay_HOOK`)
      .digest("hex");

    const verify = await request
      .post("/api/orders/razorpay/verify")
      .set(h.auth(token))
      .send({
        razorpay_order_id: intent.razorpayOrderId,
        razorpay_payment_id: "pay_HOOK",
        razorpay_signature: signature,
        items: [{ productId: String(product._id), quantity: 2 }],
        address: h.ADDRESS,
      });
    assert.equal(verify.status, 201);

    const res = await postWebhook(paymentCapturedEvent({ orderId: intent.razorpayOrderId, amount: intent.amountPaise }));
    assert.equal(res.status, 200);
    assert.equal(res.body.handled, false);
    assert.equal(await Order.countDocuments(), 1);
  });

  test("refuses to act on an amount that does not match the stored session", async () => {
    const intent = await startPayment();
    const body = paymentCapturedEvent({ orderId: intent.razorpayOrderId, amount: 100 }); // 1 rupee

    const res = await postWebhook(body);
    assert.equal(res.status, 200, "200 so Razorpay stops retrying");
    assert.equal(res.body.handled, false);
    assert.equal(await Order.countDocuments(), 0);
    assert.equal((await PaymentIntent.findById(intent._id)).status, "flagged");
  });

  test("refuses a non-INR payment", async () => {
    const intent = await startPayment();
    const body = paymentCapturedEvent({ orderId: intent.razorpayOrderId, amount: intent.amountPaise, currency: "USD" });
    const res = await postWebhook(body);
    assert.equal(res.body.handled, false);
    assert.equal(await Order.countDocuments(), 0);
  });

  test("handles a payment with no matching session without crashing", async () => {
    const body = paymentCapturedEvent({ orderId: "order_UNKNOWN", amount: 100000 });
    const res = await postWebhook(body);
    assert.equal(res.status, 200);
    assert.equal(res.body.handled, false);
    assert.equal(await Order.countDocuments(), 0);
  });

  test("ignores events other than payment.captured", async () => {
    const body = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_X" } } } });
    const res = await postWebhook(body);
    assert.equal(res.status, 200);
    assert.equal(res.body.handled, false);
  });

  test("leaves a session alone while the browser is mid-verify", async () => {
    const intent = await startPayment();
    await PaymentIntent.updateOne({ _id: intent._id }, { status: "processing" }); // browser in progress

    const res = await postWebhook(paymentCapturedEvent({ orderId: intent.razorpayOrderId, amount: intent.amountPaise }));
    assert.equal(res.status, 200);
    assert.equal(res.body.handled, false);
    assert.equal(res.body.reason, "in progress");
    assert.equal(await Order.countDocuments(), 0);
  });

  test("takes over a session the browser abandoned mid-way", async () => {
    const intent = await startPayment();
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    await PaymentIntent.collection.updateOne(
      { _id: intent._id },
      { $set: { status: "processing", updatedAt: sixMinutesAgo } }
    );

    const res = await postWebhook(paymentCapturedEvent({ orderId: intent.razorpayOrderId, amount: intent.amountPaise }));
    assert.equal(res.body.handled, true);
    assert.equal(await Order.countDocuments(), 1);
  });

  test("an item that sold out after payment gives a refund_requested order", async () => {
    const intent = await startPayment();
    await Product.updateOne({ _id: product._id }, { stock: 0 });

    const res = await postWebhook(paymentCapturedEvent({ orderId: intent.razorpayOrderId, amount: intent.amountPaise }));
    assert.equal(res.body.outcome, "refund_pending");
    const order = await Order.findOne({ razorpayPaymentId: "pay_HOOK" });
    assert.equal(order.paymentStatus, "refund_requested");
    assert.equal((await PaymentIntent.findById(intent._id)).status, "needs_refund");
  });

  test("flags a paid session that has no address instead of inventing one", async () => {
    const intent = await startPayment();
    await PaymentIntent.collection.updateOne({ _id: intent._id }, { $unset: { address: "" } });

    const res = await postWebhook(paymentCapturedEvent({ orderId: intent.razorpayOrderId, amount: intent.amountPaise }));
    assert.equal(res.status, 200);
    assert.equal(res.body.handled, false);
    assert.equal(await Order.countDocuments(), 0);
    assert.equal((await PaymentIntent.findById(intent._id)).status, "needs_manual");
  });
});
