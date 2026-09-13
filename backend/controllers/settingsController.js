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
    supportEmail,
    supportPhone,
  } = req.body;

  if (freeShippingThreshold !== undefined) settings.freeShippingThreshold = freeShippingThreshold;
  if (flatShippingFee !== undefined) settings.flatShippingFee = flatShippingFee;
  if (minimumOrderValue !== undefined) settings.minimumOrderValue = minimumOrderValue;
  if (storeName !== undefined) settings.storeName = storeName;
  if (gstNumber !== undefined) settings.gstNumber = gstNumber;
  if (supportEmail !== undefined) settings.supportEmail = supportEmail;
  if (supportPhone !== undefined) settings.supportPhone = supportPhone;

  const updated = await settings.save();
  res.json(updated);
};

module.exports = { getSettingsHandler, updateSettingsHandler };
