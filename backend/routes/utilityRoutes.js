const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/asyncHandler");

/**
 * @route   GET /api/utils/pincode/:pincode
 * @desc    Proxies India Post's public pincode lookup (https://api.postalpincode.in) so the
 *          checkout page can auto-fill city/state. Doing this server-side avoids any CORS
 *          issues in the browser and keeps the third-party API call in one place.
 * @access  Public
 */
router.get(
  "/pincode/:pincode",
  asyncHandler(async (req, res) => {
    const { pincode } = req.params;

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ message: "Pincode must be exactly 6 digits" });
    }

    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      const result = data?.[0];

      if (!result || result.Status !== "Success" || !result.PostOffice?.length) {
        return res.status(404).json({ message: "Pincode not found" });
      }

      const office = result.PostOffice[0];
      res.json({ city: office.District, state: office.State });
    } catch (error) {
      res.status(502).json({ message: "Could not reach the pincode lookup service" });
    }
  })
);

module.exports = router;
