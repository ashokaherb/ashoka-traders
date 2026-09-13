const { getActiveOffers, pickBestOffer, applyDiscount } = require("./offerPricing");

/**
 * Decorates one or more products (Mongoose docs) with display-only offer pricing:
 * originalPrice / effectivePrice on the product and each variant, plus an `offer`
 * summary if a discount applies. The stored `price` fields are never touched -
 * this only adds extra fields to the JSON sent to the frontend.
 *
 * Used by every product-reading endpoint (list, detail, related, wishlist) so the
 * storefront always shows the same discounted price everywhere.
 */
async function decorateWithOffers(products) {
  const offers = await getActiveOffers();
  const isArray = Array.isArray(products);
  const list = isArray ? products : [products];

  const decorated = list.map((doc) => {
    const obj = doc.toObject ? doc.toObject() : doc;
    const categoryId = obj.category?._id || obj.category;
    const offer = pickBestOffer(offers, categoryId);

    obj.originalPrice = obj.price;
    obj.effectivePrice = applyDiscount(obj.price, offer);
    obj.variants = (obj.variants || []).map((v) => ({
      ...(v.toObject ? v.toObject() : v),
      originalPrice: v.price,
      effectivePrice: applyDiscount(v.price, offer),
    }));
    obj.offer = offer ? { title: offer.title, discountPercent: offer.discountPercent } : null;

    return obj;
  });

  return isArray ? decorated : decorated[0];
}

module.exports = { decorateWithOffers };
