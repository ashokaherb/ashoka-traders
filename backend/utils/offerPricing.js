const Offer = require("../models/Offer");

/**
 * All offers currently in effect: active flag set, AND (if start/end dates are set)
 * today falls within that window. Called once per request/order and the result
 * passed around, rather than querying per-product.
 */
async function getActiveOffers() {
  const now = new Date();
  return Offer.find({
    active: true,
    $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ],
  });
}

/**
 * Picks the single best offer for a product in the given category, if any.
 * A category-specific offer always wins over a storewide "all" offer; among
 * ties, the bigger discount wins.
 */
function pickBestOffer(offers, categoryId) {
  const categoryStr = categoryId?.toString();
  const matching = offers.filter((o) => o.appliesTo === "all" || o.appliesTo === categoryStr);
  if (matching.length === 0) return null;

  matching.sort((a, b) => {
    const aSpecific = a.appliesTo !== "all" ? 1 : 0;
    const bSpecific = b.appliesTo !== "all" ? 1 : 0;
    if (aSpecific !== bSpecific) return bSpecific - aSpecific;
    return b.discountPercent - a.discountPercent;
  });

  return matching[0];
}

/** Applies an offer's percent discount to a price, rounded to 2 decimal places. */
function applyDiscount(price, offer) {
  if (!offer) return price;
  return Math.round(price * (1 - offer.discountPercent / 100) * 100) / 100;
}

module.exports = { getActiveOffers, pickBestOffer, applyDiscount };
