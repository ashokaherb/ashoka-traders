const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const h = require("./helpers/harness");

const Settings = require("../models/Settings");
const { resolveDocumentType, COMPOSITION_DISCLOSURE } = require("../utils/invoiceType");
const { renderInvoicePDFBuffer } = require("../utils/generateInvoicePDF");
const { amountInWords } = require("../utils/amountInWords");
const { financialYear } = require("../utils/billNumber");
const { extractPdfText } = require("./helpers/pdfText");

let request;
let token;
let adminToken;
let product;

/** The sample order used for the PDF tests. */
const sampleOrder = (overrides = {}) => ({
  _id: "66e4f1a2b3c4d5e6f7a8b9c0",
  billNumber: "AT/26-27/0007",
  createdAt: new Date("2026-09-14T10:30:00+05:30"),
  paymentMethod: "COD",
  paymentStatus: "pending",
  user: { name: "Priya Sharma", email: "priya@example.test" },
  address: { ...h.ADDRESS, name: "Priya Sharma" },
  items: [
    { name: "California Almonds", variantLabel: "500 g", price: 450, quantity: 2, hsnCode: "0802" },
    { name: "Ashwagandha Powder", variantLabel: null, price: 180, quantity: 1, hsnCode: "" },
  ],
  subtotal: 1080,
  shippingFee: 0,
  discount: 80,
  couponCode: "SAVE80",
  total: 1000,
  ...overrides,
});

const COMPOSITION = { storeName: "Aashoka Traders", gstNumber: "05ABCDE1234F1Z5", gstScheme: "composition", storeAddress: "Dehradun", invoiceTerms: "Keep this bill." };

/** The visible text of the PDF (page content is compressed - see helpers/pdfText.js). */
const pdfText = (buffer) => extractPdfText(buffer);

before(async () => {
  await h.startDb();
  request = supertest(h.getApp());
});
after(h.stopDb);

beforeEach(async () => {
  await h.clearDb();
  await h.makeSettings();
  product = await h.makeProduct({ price: 300, stock: 20 });
  await h.makeUser({ email: "buyer@test.local" });
  await h.makeAdmin();
  token = await h.login(request, "buyer@test.local");
  adminToken = await h.login(request, "admin@test.local");
});

describe("invoice document type", () => {
  test("composition + GSTIN gives a Bill of Supply", () => {
    assert.equal(resolveDocumentType({ gstScheme: "composition", gstNumber: "05ABCDE1234F1Z5" }), "bill_of_supply");
  });

  test("regular + GSTIN gives a Tax Invoice", () => {
    assert.equal(resolveDocumentType({ gstScheme: "regular", gstNumber: "05ABCDE1234F1Z5" }), "tax_invoice");
  });

  test("not registered gives a plain Receipt", () => {
    assert.equal(resolveDocumentType({ gstScheme: "not_registered", gstNumber: "" }), "receipt");
  });

  test("a registered scheme without a GSTIN falls back to a Receipt, never a fake GSTIN", () => {
    assert.equal(resolveDocumentType({ gstScheme: "composition", gstNumber: "" }), "receipt");
  });
});

describe("bill PDF", () => {
  test("a composition bill shows the mandatory disclosure and no tax at all", async () => {
    const pdf = await renderInvoicePDFBuffer(sampleOrder(), COMPOSITION, { compress: false });
    const text = pdfText(pdf);

    assert.ok(pdf.length > 1000, "a real PDF was produced");
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.match(text.replace(/\s+/g, " "), /B ?I ?L ?L ?O ?F ?S ?U ?P ?P ?L ?Y/i, "titled Bill of Supply");
    assert.ok(text.includes(COMPOSITION_DISCLOSURE.slice(0, 40)), "carries the composition disclosure");
    assert.ok(!/CGST|SGST|IGST/.test(text), "no tax breakdown anywhere");
  });

  test("a regular-scheme invoice does show the tax breakdown", async () => {
    const pdf = await renderInvoicePDFBuffer(
      sampleOrder(),
      { ...COMPOSITION, gstScheme: "regular", gstRate: 5, storeState: "Uttarakhand" },
      { compress: false }
    );
    const text = pdfText(pdf);
    assert.match(text.replace(/\s+/g, " "), /T ?A ?X ?I ?N ?V ?O ?I ?C ?E/i, "titled Tax Invoice");
    assert.ok(/CGST|SGST/.test(text), "shows the tax columns");
  });

  test("an unregistered shop gets a receipt with no GSTIN and no disclosure", async () => {
    const pdf = await renderInvoicePDFBuffer(
      sampleOrder(),
      { storeName: "Aashoka Traders", gstScheme: "not_registered", gstNumber: "" },
      { compress: false }
    );
    const text = pdfText(pdf);
    assert.ok(!text.includes("GSTIN"), "no GSTIN is printed");
    assert.ok(!text.includes(COMPOSITION_DISCLOSURE.slice(0, 40)));
  });

  test("the bill total is written in words correctly", () => {
    assert.equal(amountInWords(1000), "Rupees One Thousand Only");
    assert.equal(amountInWords(1938.6), "Rupees One Thousand Nine Hundred Thirty Eight and Sixty Paise Only");
    assert.equal(amountInWords(125050.5), "Rupees One Lakh Twenty Five Thousand Fifty and Fifty Paise Only");
    assert.equal(amountInWords(0), "Rupees Zero Only");
  });

  test("bill numbers follow the Indian financial year", () => {
    assert.equal(financialYear(new Date("2026-09-14")).label, "26-27", "September falls in FY 26-27");
    assert.equal(financialYear(new Date("2026-02-14")).label, "25-26", "February falls in the previous FY");
    assert.equal(financialYear(new Date("2026-04-01T00:30:00+05:30")).label, "26-27", "1 April starts the new FY");
  });
});

describe("invoice download", () => {
  const placeOrder = () =>
    request
      .post("/api/orders")
      .set(h.auth(token))
      .send({ items: [{ productId: String(product._id), quantity: 1 }], address: h.ADDRESS, paymentMethod: "COD" });

  test("the owner can download their bill as a PDF", async () => {
    const order = await placeOrder();
    const res = await request.get(`/api/orders/${order.body._id}/invoice`).set(h.auth(token));

    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /application\/pdf/);
    assert.match(res.headers["content-disposition"], /\.pdf/);
    assert.equal(res.body.subarray(0, 5).toString(), "%PDF-");
  });

  test("another customer cannot download someone else's bill", async () => {
    const order = await placeOrder();
    await h.makeUser({ email: "stranger@test.local" });
    const strangerToken = await h.login(request, "stranger@test.local");

    const res = await request.get(`/api/orders/${order.body._id}/invoice`).set(h.auth(strangerToken));
    assert.equal(res.status, 403);
  });

  test("the file name follows the configured GST scheme", async () => {
    await Settings.updateMany({}, { gstScheme: "composition", gstNumber: "05ABCDE1234F1Z5" });
    const order = await placeOrder();
    const res = await request.get(`/api/orders/${order.body._id}/invoice`).set(h.auth(adminToken));
    assert.match(res.headers["content-disposition"], /bill-of-supply-/);
  });
});
