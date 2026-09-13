/**
 * Thin wrapper around a WhatsApp Business Solution Provider (BSP) API - AiSensy and
 * Interakt (and most other BSPs) accept a JSON payload over a plain REST webhook with a
 * bearer/API-key header, so that's the generic shape this is written against.
 *
 * Configure via .env: WHATSAPP_API_URL, WHATSAPP_API_KEY.
 * Until both are set, every call just logs to the console instead of making a real
 * request, so the rest of the app works out of the box before a BSP account exists.
 *
 * TO SWITCH PROVIDERS: this file (specifically buildPayload() below) is the only place
 * that needs to change - every call site in the app just calls sendWhatsAppMessage()/
 * sendWhatsAppBroadcast() and never touches the BSP's actual request shape.
 */

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;

const isConfigured = Boolean(WHATSAPP_API_URL && WHATSAPP_API_KEY);

if (!isConfigured) {
  console.warn(
    "WhatsApp BSP not configured - WHATSAPP_API_URL/WHATSAPP_API_KEY are unset in .env. " +
      "WhatsApp messages will be logged to the console instead of actually sent."
  );
}

/**
 * Builds the request body your BSP expects. This is a generic text-message placeholder -
 * replace it with your BSP's actual documented payload once you've picked one and had a
 * template approved (most BSPs require an approved template for anything outside a
 * customer-initiated 24-hour support window - see the README's WhatsApp setup notes).
 */
function buildPayload(to, message) {
  return {
    to,
    type: "text",
    text: { body: message },
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends one WhatsApp message.
 * @param {string} to - phone number, ideally with country code (e.g. "91XXXXXXXXXX") -
 *   the exact format required depends on your BSP, check their docs.
 * @param {string} message - plain text body
 * @returns {Promise<{skipped: boolean, success?: boolean, reason?: string, error?: string}>}
 */
async function sendWhatsAppMessage(to, message) {
  if (!to) return { skipped: true, reason: "no phone number" };

  if (!isConfigured) {
    console.log(
      `\n--- WHATSAPP (stub - no BSP configured in .env) ---\nTo: ${to}\n${message}\n-----------------------------------------------------\n`
    );
    return { skipped: true, reason: "not configured" };
  }

  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_API_KEY}`,
      },
      body: JSON.stringify(buildPayload(to, message)),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WhatsApp API responded ${response.status}: ${text}`);
    }

    return { skipped: false, success: true };
  } catch (error) {
    console.error("WhatsApp send failed:", error.message);
    return { skipped: false, success: false, error: error.message };
  }
}

/**
 * Sends the same message to many recipients (for promotional broadcasts - new offers,
 * new arrivals). A short delay between sends keeps this comfortably under most BSPs'
 * rate limits, and one failed send never stops the rest of the broadcast.
 *
 * @param {string[]} recipients - phone numbers
 * @param {string} message
 * @returns {Promise<{sent: number, failed: number, skipped: number}>}
 */
async function sendWhatsAppBroadcast(recipients, message) {
  const results = { sent: 0, failed: 0, skipped: 0 };

  for (const to of recipients) {
    const result = await sendWhatsAppMessage(to, message);
    if (result.skipped) results.skipped++;
    else if (result.success) results.sent++;
    else results.failed++;
    await sleep(250);
  }

  return results;
}

module.exports = { sendWhatsAppMessage, sendWhatsAppBroadcast, isConfigured };
