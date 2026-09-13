const Offer = require("../models/Offer");
const Category = require("../models/Category");
const User = require("../models/User");
const { getActiveOffers } = require("../utils/offerPricing");
const { sendWhatsAppBroadcast } = require("../utils/whatsappService");

/**
 * @route   GET /api/offers/active
 * @desc    Currently-active offers, for the storefront's homepage banner
 * @access  Public
 */
const getActiveOffersHandler = async (req, res) => {
  const offers = await getActiveOffers();
  res.json(offers);
};

/**
 * @route   GET /api/offers
 * @desc    Every offer (including inactive/expired), for the admin management page
 * @access  Private/Admin
 */
const getAllOffers = async (req, res) => {
  const offers = await Offer.find().sort({ createdAt: -1 });
  res.json(offers);
};

/**
 * @route   POST /api/offers
 * @access  Private/Admin
 */
const createOffer = async (req, res) => {
  const { title, discountPercent, appliesTo, active, startDate, endDate } = req.body;
  if (!title || discountPercent === undefined) {
    return res.status(400).json({ message: "title and discountPercent are required" });
  }

  const offer = await Offer.create({
    title,
    discountPercent,
    appliesTo: appliesTo || "all",
    active: active !== undefined ? active : true,
    startDate: startDate || null,
    endDate: endDate || null,
  });

  res.status(201).json(offer);
};

/**
 * @route   PUT /api/offers/:id
 * @desc    Update any field - also how the admin page's "Active" toggle works
 * @access  Private/Admin
 */
const updateOffer = async (req, res) => {
  const offer = await Offer.findById(req.params.id);
  if (!offer) return res.status(404).json({ message: "Offer not found" });

  const { title, discountPercent, appliesTo, active, startDate, endDate } = req.body;
  if (title !== undefined) offer.title = title;
  if (discountPercent !== undefined) offer.discountPercent = discountPercent;
  if (appliesTo !== undefined) offer.appliesTo = appliesTo;
  if (active !== undefined) offer.active = active;
  if (startDate !== undefined) offer.startDate = startDate || null;
  if (endDate !== undefined) offer.endDate = endDate || null;

  const updated = await offer.save();
  res.json(updated);
};

/**
 * @route   DELETE /api/offers/:id
 * @access  Private/Admin
 */
const deleteOffer = async (req, res) => {
  const offer = await Offer.findById(req.params.id);
  if (!offer) return res.status(404).json({ message: "Offer not found" });

  await offer.deleteOne();
  res.json({ message: "Offer deleted" });
};

/**
 * @route   POST /api/offers/:id/broadcast
 * @desc    Sends a WhatsApp broadcast about this offer to every opted-in customer.
 *          Deliberately a separate, admin-triggered action (not fired automatically on
 *          create/save) - saving an offer while adjusting it shouldn't spam customers
 *          every time, and the admin should always know exactly when a broadcast goes out.
 * @access  Private/Admin
 */
const broadcastOffer = async (req, res) => {
  const offer = await Offer.findById(req.params.id);
  if (!offer) return res.status(404).json({ message: "Offer not found" });

  const recipients = await User.find({ whatsappOptIn: true, whatsappNumber: { $ne: "" } }).select(
    "whatsappNumber"
  );

  let scopeText = "all products";
  if (offer.appliesTo !== "all") {
    const category = await Category.findById(offer.appliesTo);
    scopeText = category ? category.name : "select products";
  }

  const message = `${offer.title}\n${offer.discountPercent}% off on ${scopeText} at Ashoka Traders - shop now!`;
  const result = await sendWhatsAppBroadcast(
    recipients.map((u) => u.whatsappNumber),
    message
  );

  res.json({ recipientCount: recipients.length, ...result });
};

module.exports = {
  getActiveOffersHandler,
  getAllOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  broadcastOffer,
};
