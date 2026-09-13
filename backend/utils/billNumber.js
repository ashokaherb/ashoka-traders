const Counter = require("../models/Counter");
const Order = require("../models/Order");

// Bill numbers must be consecutive, unique within a financial year, and at most 16
// characters (CGST Rules, rule 46/49). Format: AT/26-27/0001 (13 characters).
const BILL_PREFIX = "AT";

// Indian financial year (April-March) for a date, e.g. 14 Sep 2026 -> { start: 2026, label: "26-27" }.
function financialYear(date = new Date()) {
  // Use IST so an order placed just after midnight on 1 April counts in the new year.
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const start = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  const two = (y) => String(y % 100).padStart(2, "0");
  return { start, label: `${two(start)}-${two(start + 1)}` };
}

/**
 * Reserves the next bill number for an order placed at `date`. Pass the order's
 * transaction session so an order that rolls back doesn't use up (and skip) a number.
 */
async function nextBillNumber(date = new Date(), session) {
  const { start, label } = financialYear(date);
  const counter = await Counter.findOneAndUpdate(
    { _id: `bill-${start}-${start + 1}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return `${BILL_PREFIX}/${label}/${String(counter.seq).padStart(4, "0")}`;
}

/**
 * Orders placed before bill numbers existed get one the first time their bill is
 * downloaded. The conditional update means two simultaneous downloads can't give one
 * order two numbers (the loser's reserved number would be skipped, which is why new
 * orders get theirs at checkout instead).
 */
async function ensureBillNumber(order) {
  if (order.billNumber) return order.billNumber;
  const billNumber = await nextBillNumber(order.createdAt);
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, billNumber: null },
    { $set: { billNumber } },
    { new: true }
  );
  order.billNumber = updated ? updated.billNumber : (await Order.findById(order._id).select("billNumber")).billNumber;
  return order.billNumber;
}

module.exports = { nextBillNumber, ensureBillNumber, financialYear };
