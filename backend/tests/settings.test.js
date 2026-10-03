const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const h = require("./helpers/harness");

const Settings = require("../models/Settings");

let request;
let adminToken;
let customerToken;

before(async () => {
  await h.startDb();
  request = supertest(h.getApp());
});
after(h.stopDb);

beforeEach(async () => {
  await h.clearDb();
  await h.makeSettings();
  await h.makeAdmin();
  await h.makeUser({ email: "shopper@test.local" });
  adminToken = await h.login(request, "admin@test.local");
  customerToken = await h.login(request, "shopper@test.local");
});

const save = (body, token = adminToken) => request.put("/api/settings").set(h.auth(token)).send(body);

describe("store settings", () => {
  test("anyone can read settings (checkout needs the shipping rule)", async () => {
    const res = await request.get("/api/settings");
    assert.equal(res.status, 200);
    assert.equal(res.body.flatShippingFee, 49);
  });

  test("only an admin can change them", async () => {
    assert.equal((await request.put("/api/settings").send({ storeName: "Hacked" })).status, 401);
    assert.equal((await save({ storeName: "Hacked" }, customerToken)).status, 403);
    assert.equal((await Settings.findOne()).storeName, "Aashoka Traders");
  });

  test("a real GSTIN with the composition scheme is accepted", async () => {
    const res = await save({ gstScheme: "composition", gstNumber: "05abcde1234f1z5", panNumber: "abcde1234f" });
    assert.equal(res.status, 200);
    assert.equal(res.body.gstNumber, "05ABCDE1234F1Z5", "stored in capitals");
    assert.equal(res.body.panNumber, "ABCDE1234F");
    assert.equal(res.body.gstScheme, "composition");
  });

  test("the sample GSTIN from the docs is refused", async () => {
    const res = await save({ gstScheme: "composition", gstNumber: "22AAAAA0000A1Z5" });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /sample GSTIN/i);
  });

  test("a malformed GSTIN is refused", async () => {
    assert.equal((await save({ gstNumber: "12345" })).status, 400);
    assert.equal((await save({ gstNumber: "05ABCDE1234F1Q5" })).status, 400, "the fixed Z is checked");
  });

  test("a registered scheme without a GSTIN is refused", async () => {
    const res = await save({ gstScheme: "composition", gstNumber: "" });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /GSTIN/i);
  });

  test("an unknown GST scheme is refused", async () => {
    assert.equal((await save({ gstScheme: "lumpsum" })).status, 400);
  });

  test("a malformed PAN is refused", async () => {
    assert.equal((await save({ panNumber: "NOTAPAN" })).status, 400);
  });

  test("shipping numbers are validated", async () => {
    assert.equal((await save({ flatShippingFee: -10 })).status, 400);
    assert.equal((await save({ flatShippingFee: "free" })).status, 400);
    const ok = await save({ flatShippingFee: 59, freeShippingThreshold: 1500 });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.flatShippingFee, 59);
  });

  test("unknown fields are ignored instead of being stored", async () => {
    const res = await save({ storeName: "Aashoka Traders", isAdminBackdoor: true, _id: "000000000000000000000000" });
    assert.equal(res.status, 200);
    const stored = await Settings.findOne().lean();
    assert.equal(stored.isAdminBackdoor, undefined);
  });

  test("a support email must look like an email, but may be cleared", async () => {
    assert.equal((await save({ supportEmail: "not-an-email" })).status, 400);
    assert.equal((await save({ supportEmail: "" })).status, 200);
    assert.equal((await save({ supportEmail: "shop@example.com" })).status, 200);
  });
});
