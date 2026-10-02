const { renderInvoicePDFBuffer, invoiceFileName } = require("./generateInvoicePDF");
const { getSettings } = require("./orderHelpers");
const { sendOrderConfirmationEmail, sendAdminNewOrderAlert } = require("./sendEmail");
const { sendWhatsAppMessage } = require("./whatsappService");

// Order notifications, shared by every path that places an order: COD checkout, the
// Razorpay browser callback, and the Razorpay webhook (utils/fulfillPaidOrder.js).
// All of them are fire-and-forget - a slow or broken mail/WhatsApp provider must never
// fail an order that has already been taken and paid for.

/**
 * Emails the customer their confirmation and the admin a new-order alert, both with the
 * order's bill PDF attached (the same document as the "Download Invoice" button).
 * If the PDF can't be built, the emails still go out without it.
 */
const notifyByEmail = (user, order) => {
  (async () => {
    let attachments = [];
    try {
      const settings = await getSettings();
      const plainOrder = typeof order.toObject === "function" ? order.toObject() : order;
      const orderForBill = { ...plainOrder, user: { name: user.name, email: user.email } };
      const pdf = await renderInvoicePDFBuffer(orderForBill, settings);
      attachments = [{ filename: invoiceFileName(order, settings), content: pdf, contentType: "application/pdf" }];
    } catch (err) {
      console.error(`[EMAIL] Could not build bill PDF for order ${order._id}, sending emails without it:`, err.message);
    }
    await Promise.allSettled([
      sendOrderConfirmationEmail(user, order, attachments),
      sendAdminNewOrderAlert(order, attachments),
    ]); // individual failures are already logged by sendMail
  })().catch((err) => console.error("Email error:", err.message));
};

/**
 * Transactional WhatsApp messages - order confirmation to the customer and a new-order
 * alert to the admin. These are sent regardless of the customer's promotional opt-in
 * (whatsappOptIn) - only whether we HAVE a number for them matters, since a number is
 * only ever collected through the opt-in flow in the first place. Promotional broadcasts
 * (offers, new arrivals) are the ones that check whatsappOptIn.
 */
const notifyByWhatsApp = (user, order) => {
  const orderNumber = order._id.toString().slice(-8).toUpperCase();
  const itemsSummary = order.items
    .map((i) => `${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} x${i.quantity}`)
    .join(", ");

  if (user.whatsappNumber) {
    sendWhatsAppMessage(
      user.whatsappNumber,
      `Hi ${user.name}, your Ashoka Traders order #${orderNumber} is confirmed!\nItems: ${itemsSummary}\nTotal: Rs.${order.total}\nPayment: ${order.paymentMethod} (${order.paymentStatus})`
    ).catch((err) => console.error("WhatsApp send error:", err.message));
  }

  if (process.env.ADMIN_WHATSAPP_NUMBER) {
    sendWhatsAppMessage(
      process.env.ADMIN_WHATSAPP_NUMBER,
      `New order #${orderNumber} from ${user.name} - Rs.${order.total} (${order.paymentMethod})`
    ).catch((err) => console.error("WhatsApp send error:", err.message));
  }
};

module.exports = { notifyByEmail, notifyByWhatsApp };
