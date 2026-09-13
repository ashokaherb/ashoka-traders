const nodemailer = require("nodemailer");

/**
 * Only build a real SMTP transporter if credentials are set in .env.
 * Otherwise every email just gets logged to the console - this keeps order
 * creation working out of the box before you have real email credentials.
 */
let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Checks the SMTP login once at startup and logs the result, so a broken email setup shows
 * up in the server logs straight away - not only when a customer's email silently fails.
 * The classic Brevo failure is "525 Unauthorized IP address": the server's IP isn't in
 * Brevo -> Security -> Authorised IPs (see DEPLOYMENT.md).
 */
const verifyEmailSetup = async () => {
  if (!transporter) {
    console.warn("[EMAIL] SMTP not configured - emails will only be logged to the console.");
    return;
  }
  try {
    await transporter.verify();
    console.log(`[EMAIL] SMTP login OK (${process.env.SMTP_HOST}) - order emails will be sent.`);
  } catch (err) {
    console.error(`[EMAIL] SMTP login FAILED (${process.env.SMTP_HOST}): ${err.message} - order emails will NOT be delivered until this is fixed.`);
  }
};

/**
 * @param {{ to: string, subject: string, text: string,
 *           attachments?: Array<{ filename: string, content: Buffer, contentType?: string }> }} mail
 */
const sendMail = async ({ to, subject, text, attachments = [] }) => {
  if (!transporter) {
    const files = attachments.map((a) => `${a.filename} (${Math.round(a.content.length / 1024)} KB)`).join(", ");
    console.log(
      `\n--- EMAIL (stub - no SMTP configured in .env) ---\nTo: ${to}\nSubject: ${subject}${files ? `\nAttachments: ${files}` : ""}\n\n${text}\n---------------------------------------------------\n`
    );
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      attachments,
    });
    console.log(`[EMAIL SENT] "${subject}" -> ${to}${attachments.length ? ` (+${attachments.length} attachment)` : ""}`);
  } catch (err) {
    console.error(`[EMAIL FAILED] "${subject}" -> ${to}: ${err.message}`);
    throw err;
  }
};

// Plain-text summary shared by both emails below.
const formatOrderSummary = (order) => {
  const lines = order.items.map(
    (item) =>
      `  - ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ""} x${item.quantity} - Rs.${item.price * item.quantity}`
  );
  return [
    `Order #${order._id}`,
    ...lines,
    `Subtotal: Rs.${order.subtotal}`,
    `Shipping: Rs.${order.shippingFee}`,
    `Discount: -Rs.${order.discount}`,
    `Total: Rs.${order.total}`,
    `Payment: ${order.paymentMethod} (${order.paymentStatus})`,
  ].join("\n");
};

/**
 * Sent to the customer right after their order is placed/paid.
 * @param {Array} [attachments] - the order's bill PDF (see orderController notifyByEmail)
 */
const sendOrderConfirmationEmail = async (user, order, attachments = []) => {
  await sendMail({
    to: user.email,
    subject: `Your Ashoka Traders order #${order._id} is confirmed`,
    text:
      `Hi ${user.name},\n\nThanks for your order! Here's a summary:\n\n${formatOrderSummary(order)}\n\n` +
      (attachments.length ? "Your bill is attached as a PDF.\n\n" : "") +
      "We'll let you know as it ships.",
    attachments,
  });
};

/**
 * Sent to the shop's admin email (ADMIN_EMAIL in .env) whenever a new order comes in.
 * @param {Array} [attachments] - the order's bill PDF
 */
const sendAdminNewOrderAlert = async (order, attachments = []) => {
  await sendMail({
    to: process.env.ADMIN_EMAIL,
    subject: `New order received - #${order._id}`,
    text: `A new order was just placed.\n\n${formatOrderSummary(order)}${attachments.length ? "\n\nThe customer's bill is attached." : ""}`,
    attachments,
  });
};

/**
 * Sent to the admin when a customer has PAID but the order can't be fulfilled because an
 * item sold out between checkout and payment (audit C3). The order is saved as Cancelled
 * with paymentStatus "refund_requested" - the money has to be refunded by hand in the
 * Razorpay dashboard, so this email is the admin's to-do item.
 *
 * Only triggered by that automatic case. An admin manually setting "refund_requested" on
 * the Order Detail page doesn't send it - they already know.
 */
const sendAdminRefundRequiredAlert = async (order, { user, reason }) => {
  await sendMail({
    to: process.env.ADMIN_EMAIL,
    subject: `[Action Needed] Refund required for Order #${order._id} — item sold out after payment`,
    text: [
      `A customer paid online, but their order could NOT be placed: ${reason}.`,
      `The order has been saved as Cancelled / refund_requested and no stock was deducted.`,
      ``,
      `REFUND TO ISSUE`,
      `  Amount:              Rs.${order.total}`,
      `  Razorpay payment ID: ${order.razorpayPaymentId}`,
      `  Razorpay order ID:   ${order.razorpayOrderId}`,
      ``,
      `CUSTOMER`,
      `  Name:  ${user.name}`,
      `  Email: ${user.email}`,
      `  Phone: ${order.address?.phone || user.phone || "-"}`,
      ``,
      formatOrderSummary(order),
      ``,
      `WHAT TO DO`,
      `  1. Razorpay Dashboard -> Transactions -> Payments -> search the payment ID above -> Refund (full amount).`,
      `  2. Admin panel -> Orders -> this order -> set Payment Status to "refunded" and save,`,
      `     so the customer sees it in their "My Orders".`,
      `  3. Optionally contact the customer to apologise / offer an alternative.`,
    ].join("\n"),
  });
};

/** Sent to everyone who clicked "Notify Me" once a product is back in stock. */
const sendBackInStockEmail = async (user, product) => {
  await sendMail({
    to: user.email,
    subject: `${product.name} is back in stock!`,
    text: `Hi ${user.name},\n\nGood news - "${product.name}" is back in stock at Ashoka Traders.\n\nGrab it before it sells out again!`,
  });
};

/** Sent to the admin whenever a customer submits the Contact Us form. */
const sendAdminContactQueryAlert = async (query) => {
  await sendMail({
    to: process.env.ADMIN_EMAIL,
    subject: `New contact form query from ${query.name}`,
    text: `Name: ${query.name}\nEmail: ${query.email}\nPhone: ${query.phone || "-"}\n\nMessage:\n${query.message}`,
  });
};

module.exports = {
  verifyEmailSetup,
  sendOrderConfirmationEmail,
  sendAdminNewOrderAlert,
  sendAdminRefundRequiredAlert,
  sendBackInStockEmail,
  sendAdminContactQueryAlert,
};
