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

const sendMail = async ({ to, subject, text }) => {
  if (!transporter) {
    console.log(
      `\n--- EMAIL (stub - no SMTP configured in .env) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n---------------------------------------------------\n`
    );
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
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

/** Sent to the customer right after their order is placed/paid. */
const sendOrderConfirmationEmail = async (user, order) => {
  await sendMail({
    to: user.email,
    subject: `Your Ashoka Traders order #${order._id} is confirmed`,
    text: `Hi ${user.name},\n\nThanks for your order! Here's a summary:\n\n${formatOrderSummary(order)}\n\nWe'll let you know as it ships.`,
  });
};

/** Sent to the shop's admin email (ADMIN_EMAIL in .env) whenever a new order comes in. */
const sendAdminNewOrderAlert = async (order) => {
  await sendMail({
    to: process.env.ADMIN_EMAIL,
    subject: `New order received - #${order._id}`,
    text: `A new order was just placed.\n\n${formatOrderSummary(order)}`,
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
  sendOrderConfirmationEmail,
  sendAdminNewOrderAlert,
  sendBackInStockEmail,
  sendAdminContactQueryAlert,
};
