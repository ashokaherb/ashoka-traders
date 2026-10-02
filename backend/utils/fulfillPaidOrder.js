const Order = require("../models/Order");
const PaymentIntent = require("../models/PaymentIntent");
const { decrementStock, runInTransaction, OutOfStockError } = require("./orderHelpers");
const { claimCouponUse } = require("./couponRules");
const { nextBillNumber } = require("./billNumber");
const { sendAdminRefundRequiredAlert } = require("./sendEmail");
const { notifyByEmail, notifyByWhatsApp } = require("./orderNotifications");

/**
 * Turns a PAID PaymentIntent into a real Order.
 *
 * This is the single place a paid order is created, used by both:
 *   - the browser callback  (POST /api/orders/razorpay/verify)
 *   - the Razorpay webhook  (POST /api/webhooks/razorpay)
 * so the two can never drift apart. The caller is responsible for everything that comes
 * BEFORE this: verifying the signature, confirming the amount with Razorpay, and claiming
 * the intent (status "created"/stale "processing" -> "processing").
 *
 * Everything in the order is built from the STORED intent, never from request input -
 * the only exception is the address, which the caller passes (the browser sends it at
 * checkout; the webhook uses the copy saved on the intent).
 *
 * @returns {Promise<{ outcome: "created"|"refund_pending", order: object }>}
 *   "created"        - stock deducted, order placed, notifications sent
 *   "refund_pending" - an item sold out after payment; a Cancelled/refund_requested order
 *                      was recorded and the admin alerted. No stock was touched.
 */
async function fulfillPaidIntent({ intent, user, address, razorpayPaymentId, source = "verify" }) {
  const orderFields = {
    user: intent.user,
    items: intent.items,
    address,
    subtotal: intent.subtotal,
    shippingFee: intent.shippingFee,
    discount: intent.discount,
    couponCode: intent.couponCode,
    total: intent.total,
    paymentMethod: "Razorpay",
    razorpayOrderId: intent.razorpayOrderId,
    razorpayPaymentId,
  };

  try {
    // Stock deduction, coupon use, order creation and burning the intent all commit
    // together (audit C3) - or none of them do.
    const order = await runInTransaction(async (session) => {
      await decrementStock(intent.items, session);
      // Already paid at the discounted price, so the order goes through even if the
      // coupon's last use was taken while this customer was paying.
      if (intent.couponCode) {
        const withinLimit = await claimCouponUse(intent.couponCode, session);
        if (!withinLimit) {
          await claimCouponUse(intent.couponCode, session, { enforceLimit: false });
          console.warn(
            `[COUPON LIMIT EXCEEDED] ${intent.couponCode} used past its limit by paid order (${intent.razorpayOrderId})`
          );
        }
      }
      const [created] = await Order.create(
        [
          {
            ...orderFields,
            billNumber: await nextBillNumber(new Date(), session),
            paymentStatus: "paid",
            orderStatus: "Placed",
          },
        ],
        { session }
      );
      await PaymentIntent.updateOne(
        { _id: intent._id },
        { $set: { status: "consumed", order: created._id, razorpayPaymentId } },
        { session }
      );
      return created;
    });

    notifyByEmail(user, order);
    notifyByWhatsApp(user, order);
    return { outcome: "created", order };
  } catch (error) {
    if (!(error instanceof OutOfStockError)) throw error;

    // The customer HAS paid, but an item sold out between checkout and payment. The
    // transaction rolled back, so no stock was touched. Don't just fail and lose track of
    // their money - record a cancelled order with a refund request so it shows up in the
    // admin's order list AND the customer's "My Orders".
    // (Refunds themselves are issued in the Razorpay dashboard.)
    const refundOrder = await Order.create({
      ...orderFields,
      paymentStatus: "refund_requested",
      orderStatus: "Cancelled",
    });
    await PaymentIntent.updateOne(
      { _id: intent._id },
      // No TTL - keep this record until the refund is dealt with
      { $set: { status: "needs_refund", order: refundOrder._id, razorpayPaymentId, expiresAt: null } }
    );
    console.error(
      `[REFUND NEEDED] Paid order could not be fulfilled (${source}) - ${error.message}.`,
      JSON.stringify({ orderId: refundOrder._id, razorpayPaymentId, amount: intent.total, userId: String(intent.user) })
    );
    sendAdminRefundRequiredAlert(refundOrder, { user, reason: error.message }).catch((err) =>
      console.error("Email error (refund alert):", err.message)
    );

    return { outcome: "refund_pending", order: refundOrder };
  }
}

module.exports = { fulfillPaidIntent };
