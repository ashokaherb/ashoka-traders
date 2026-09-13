const { sendAdminContactQueryAlert } = require("../utils/sendEmail");
const { sendWhatsAppMessage } = require("../utils/whatsappService");

/**
 * @route   POST /api/contact
 * @desc    Handles the storefront's Contact Us form. Alerts the admin by email AND
 *          WhatsApp (if ADMIN_WHATSAPP_NUMBER is set) - this is a transactional alert
 *          about a customer query, not a promotional message, so it's sent regardless
 *          of anyone's WhatsApp opt-in status (it's going TO the admin, not a customer).
 *          Queries aren't persisted to the database - this just relays them immediately.
 * @access  Public (guests can contact support without an account)
 */
const submitContactQuery = async (req, res) => {
  const { name, email, phone, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ message: "Name, email and message are required" });
  }

  const query = { name, email, phone, message };

  // Fire-and-forget - a slow/broken notification channel should never fail the
  // customer's submission itself.
  sendAdminContactQueryAlert(query).catch((err) => console.error("Email error:", err.message));

  if (process.env.ADMIN_WHATSAPP_NUMBER) {
    sendWhatsAppMessage(
      process.env.ADMIN_WHATSAPP_NUMBER,
      `New contact query from ${name} (${email}${phone ? ", " + phone : ""}):\n${message}`
    ).catch((err) => console.error("WhatsApp send error:", err.message));
  }

  res.json({ message: "Thanks! We'll get back to you soon." });
};

module.exports = { submitContactQuery };
