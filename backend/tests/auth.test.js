const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const jwt = require("jsonwebtoken");
const h = require("./helpers/harness");

let request;

before(async () => {
  await h.startDb();
  request = supertest(h.getApp());
});
after(h.stopDb);
beforeEach(h.clearDb);

describe("authentication", () => {
  test("registers a customer and returns a token", async () => {
    const res = await request
      .post("/api/auth/register")
      .send({ name: "Priya Sharma", email: "priya@example.com", password: "secret12", phone: "9876543210" });

    assert.equal(res.status, 201);
    assert.equal(res.body.email, "priya@example.com");
    assert.ok(res.body.token, "a token is returned");
    assert.equal(res.body.isAdmin, false, "new accounts are never admins");
    assert.equal(res.body.password, undefined, "the password hash is never returned");
  });

  test("refuses a second account with the same email", async () => {
    await h.makeUser({ email: "dup@test.local" });
    const res = await request
      .post("/api/auth/register")
      .send({ name: "Copy", email: "dup@test.local", password: "secret12" });
    assert.equal(res.status, 400);
  });

  test("refuses a malformed email address", async () => {
    const res = await request.post("/api/auth/register").send({ name: "Bad", email: "abc", password: "secret12" });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /valid email/i);
  });

  test("refuses a password shorter than 6 characters", async () => {
    const res = await request.post("/api/auth/register").send({ name: "Short", email: "s@test.local", password: "123" });
    assert.equal(res.status, 400);
  });

  test("logs in with the right password and rejects the wrong one", async () => {
    await h.makeUser({ email: "login@test.local" });

    const ok = await request.post("/api/auth/login").send({ email: "login@test.local", password: h.PASSWORD });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);

    const bad = await request.post("/api/auth/login").send({ email: "login@test.local", password: "wrong-password" });
    assert.equal(bad.status, 401);
    assert.equal(bad.body.token, undefined);
  });

  test("a protected route needs a token", async () => {
    const anon = await request.get("/api/auth/me");
    assert.equal(anon.status, 401);

    const user = await h.makeUser({ email: "me@test.local" });
    const token = await h.login(request, "me@test.local");
    const res = await request.get("/api/auth/me").set(h.auth(token));
    assert.equal(res.status, 200);
    assert.equal(res.body._id, String(user._id));
  });

  test("an admin route refuses a customer token", async () => {
    await h.makeUser({ email: "shopper@test.local" });
    const token = await h.login(request, "shopper@test.local");
    const res = await request.get("/api/orders").set(h.auth(token));
    assert.equal(res.status, 403);
  });

  test("an admin route accepts an admin token", async () => {
    await h.makeAdmin();
    const token = await h.login(request, "admin@test.local");
    const res = await request.get("/api/orders").set(h.auth(token));
    assert.equal(res.status, 200);
  });

  test("an expired token is refused with SESSION_EXPIRED", async () => {
    const user = await h.makeUser({ email: "expired@test.local" });
    const expired = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "-1h" });
    const res = await request.get("/api/auth/me").set(h.auth(expired));
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "SESSION_EXPIRED");
  });

  test("a token older than the role's lifetime is refused even if it hasn't expired", async () => {
    const user = await h.makeUser({ email: "old@test.local" });
    // Issued 40 days ago but with a long exp - the server checks the token's AGE by role.
    const old = jwt.sign(
      { id: String(user._id), iat: Math.floor(Date.now() / 1000) - 40 * 24 * 3600 },
      process.env.JWT_SECRET,
      { expiresIn: "365d" }
    );
    const res = await request.get("/api/auth/me").set(h.auth(old));
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "SESSION_EXPIRED");
  });

  test("a token signed with the wrong secret is refused", async () => {
    const user = await h.makeUser({ email: "forged@test.local" });
    const forged = jwt.sign({ id: String(user._id) }, "not-the-real-secret", { expiresIn: "1h" });
    const res = await request.get("/api/auth/me").set(h.auth(forged));
    assert.equal(res.status, 401);
  });

  test("admins cannot refresh their session; customers can", async () => {
    await h.makeAdmin();
    const adminToken = await h.login(request, "admin@test.local");
    const adminRes = await request.post("/api/auth/refresh").set(h.auth(adminToken));
    assert.equal(adminRes.status, 403);
    assert.equal(adminRes.body.code, "REFRESH_NOT_ALLOWED");

    await h.makeUser({ email: "refresh@test.local" });
    const token = await h.login(request, "refresh@test.local");
    const res = await request.post("/api/auth/refresh").set(h.auth(token));
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });
});
