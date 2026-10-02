#!/usr/bin/env node
/**
 * Checks the live email setup without placing an order.
 *
 *   npm run verify:email                 - logs in to SMTP and reports the result
 *   npm run verify:email -- you@mail.com - also sends one test email (with a sample bill PDF)
 *
 * Run it on the machine whose IP has to be allowed (your laptop locally, or Render's shell
 * for production), because the usual Brevo failure is "525 Unauthorized IP address" - the
 * credentials are right but the server's IP isn't on Brevo's allow-list.
 */
require("dotenv").config();
const nodemailer = require("nodemailer");
const { renderInvoicePDFBuffer } = require("../utils/generateInvoicePDF");

const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
const missing = required.filter((key) => !process.env[key]);

const sampleOrder = {
  _id: "000000000000000000000000",
  billNumber: "AT/00-00/0000",
  createdAt: new Date(),
  paymentMethod: "COD",
  paymentStatus: "pending",
  user: { name: "Email Test", email: process.env.ADMIN_EMAIL || "test@example.com" },
  address: {
    name: "Email Test",
    phone: "9876543210",
    addressLine: "Sample address",
    pincode: "248001",
    city: "Dehradun",
    state: "Uttarakhand",
  },
  items: [{ name: "Sample item", variantLabel: null, price: 100, quantity: 1, hsnCode: "" }],
  subtotal: 100,
  shippingFee: 0,
  discount: 0,
  total: 100,
};

(async () => {
  console.log("Email configuration");
  console.log(`  SMTP_HOST   ${process.env.SMTP_HOST || "(not set)"}`);
  console.log(`  SMTP_PORT   ${process.env.SMTP_PORT || "587 (default)"}`);
  console.log(`  SMTP_USER   ${process.env.SMTP_USER ? "set" : "(not set)"}`);
  console.log(`  SMTP_PASS   ${process.env.SMTP_PASS ? "set" : "(not set)"}`);
  console.log(`  EMAIL_FROM  ${process.env.EMAIL_FROM || "(falls back to SMTP_USER)"}`);
  console.log(`  ADMIN_EMAIL ${process.env.ADMIN_EMAIL || "(not set - admin alerts have nowhere to go)"}`);

  if (missing.length) {
    console.error(`\nFAIL: ${missing.join(", ")} not set. Emails would only be logged, never sent.`);
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    await transporter.verify();
    console.log("\nPASS: SMTP login accepted from this machine.");
  } catch (err) {
    console.error(`\nFAIL: SMTP login refused - ${err.message}`);
    if (/unauthorized ip/i.test(err.message) || err.responseCode === 525) {
      console.error("  This is Brevo's IP allow-list. Either authorise this server's IP in");
      console.error("  Brevo > Security > Authorised IPs, or turn off blocking for SMTP keys.");
    }
    if (err.responseCode === 535) console.error("  535 means the login/password itself is wrong.");
    process.exit(1);
  }

  const to = process.argv[2];
  if (!to) {
    console.log("\nNo recipient given, so no test email was sent.");
    console.log("Send one with:  npm run verify:email -- you@example.com");
    process.exit(0);
  }

  const pdf = await renderInvoicePDFBuffer(sampleOrder, {
    storeName: "Ashoka Traders",
    gstScheme: process.env.TEST_GST_SCHEME || "not_registered",
    gstNumber: "",
    storeAddress: "Sample address",
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Ashoka Traders - email delivery test",
    text: [
      "This is a test email from the Ashoka Traders backend.",
      "",
      "If you can read this, SMTP delivery works from this server.",
      "A sample bill PDF is attached - the same generator used for real orders.",
      `Sent at ${new Date().toISOString()}`,
    ].join("\n"),
    attachments: [{ filename: "sample-bill.pdf", content: pdf, contentType: "application/pdf" }],
  });

  console.log(`PASS: test email sent to ${to} (check the inbox AND the spam folder).`);
  process.exit(0);
})().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
