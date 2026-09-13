const Settings = require("../models/Settings");

/**
 * @route   GET /api/settings
 * @desc    Get store-wide settings (shipping rule, minimum order value, store/GST info).
 *          Public because the storefront needs it for checkout. Settings is a singleton -
 *          if no document exists yet, one is created with defaults.
 * @access  Public
 */
const getSettingsHandler = async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  res.json(settings);
};

/**
 * @route   PUT /api/settings
 * @desc    Update store settings - the admin Settings page's save button.
 * @access  Private/Admin
 */
const updateSettingsHandler = async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = new Settings();

  const {
    freeShippingThreshold,
    flatShippingFee,
    minimumOrderValue,
    storeName,
    gstNumber,
    gstScheme,
    gstRate,
    storeState,
    storeAddress,
    panNumber,
    invoiceTerms,
    supportEmail,
    supportPhone,
  } = req.body;

  if (freeShippingThreshold !== undefined) settings.freeShippingThreshold = freeShippingThreshold;
  if (flatShippingFee !== undefined) settings.flatShippingFee = flatShippingFee;
  if (minimumOrderValue !== undefined) settings.minimumOrderValue = minimumOrderValue;
  if (storeName !== undefined) settings.storeName = storeName;
  if (gstNumber !== undefined) settings.gstNumber = gstNumber;
  if (gstScheme !== undefined) settings.gstScheme = gstScheme; // enum-validated by the model
  if (gstRate !== undefined) settings.gstRate = gstRate;
  if (storeState !== undefined) settings.storeState = storeState;
  if (storeAddress !== undefined) settings.storeAddress = storeAddress;
  if (panNumber !== undefined) settings.panNumber = panNumber;
  if (invoiceTerms !== undefined) settings.invoiceTerms = invoiceTerms;
  if (supportEmail !== undefined) settings.supportEmail = supportEmail;
  if (supportPhone !== undefined) settings.supportPhone = supportPhone;

  // A registered scheme without a GSTIN would silently fall back to a plain receipt - make
  // the admin fix it instead of discovering it on a customer's invoice.
  if (settings.gstScheme !== "not_registered" && !settings.gstNumber) {
    return res.status(400).json({ message: "Enter the GSTIN, or set GST Scheme to Not Registered." });
  }

  const updated = await settings.save();
  res.json(updated);
};

module.exports = { getSettingsHandler, updateSettingsHandler };
