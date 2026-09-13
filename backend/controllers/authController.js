const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { MAX_SESSION_SECONDS } = require("../utils/generateToken");

/**
 * @route   POST /api/auth/register
 * @desc    Register a new customer account
 * @access  Public
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, whatsappOptIn, whatsappNumber } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    // Note: isAdmin is intentionally never taken from req.body - it defaults to false.
    // The only admin account is created via the seed script (seed/seedAdmin.js).
    const optingIn = Boolean(whatsappOptIn);
    const user = await User.create({
      name,
      email,
      password,
      phone,
      whatsappOptIn: optingIn,
      whatsappNumber: optingIn ? whatsappNumber : "",
      whatsappOptInDate: optingIn ? new Date() : null, // consent timestamp, for compliance record-keeping
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin,
      address: user.address,
      whatsappOptIn: user.whatsappOptIn,
      whatsappNumber: user.whatsappNumber,
      whatsappOptInDate: user.whatsappOptInDate,
      token: generateToken(user), // lifetime depends on role - see utils/generateToken.js
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Log in a customer OR the admin (same endpoint, isAdmin comes back in the response)
 * @access  Public
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // password has select:false on the schema, so we explicitly ask for it here
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin,
      address: user.address,
      whatsappOptIn: user.whatsappOptIn,
      whatsappNumber: user.whatsappNumber,
      whatsappOptInDate: user.whatsappOptInDate,
      token: generateToken(user), // lifetime depends on role - see utils/generateToken.js
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get the currently logged-in user's profile (from the JWT)
 * @access  Private
 */
const getMe = async (req, res) => {
  // req.user was already attached by the "protect" middleware
  res.json(req.user);
};

/**
 * @route   POST /api/auth/refresh
 * @desc    Swap a still-valid customer token for a fresh one, so an active customer isn't
 *          logged out every 7 days. The storefront calls this silently in the background.
 *
 *          Two limits keep refreshing from making a stolen token last forever:
 *           - The new token keeps the ORIGINAL login time (authTime). Once that is older
 *             than JWT_MAX_SESSION (30 days), refresh is refused - password required.
 *           - Admin tokens can't be refreshed at all. Admin sessions are deliberately
 *             capped at 24h: after that, the admin logs in again.
 * @access  Private (customers only)
 */
const refreshToken = async (req, res) => {
  if (req.user.isAdmin) {
    return res.status(403).json({
      message: "Admin sessions can't be extended. Please log in again.",
      code: "REFRESH_NOT_ALLOWED",
    });
  }

  // Tokens issued before authTime existed fall back to their issue time
  const authTime = req.tokenPayload.authTime ?? req.tokenPayload.iat;
  const sessionAgeSeconds = Math.floor(Date.now() / 1000) - authTime;
  if (sessionAgeSeconds > MAX_SESSION_SECONDS) {
    return res.status(401).json({
      message: "For your security, please log in again.",
      code: "SESSION_EXPIRED",
    });
  }

  res.json({ token: generateToken(req.user, { authTime }) });
};

/**
 * @route   PUT /api/auth/address
 * @desc    Save/update the logged-in customer's address, for reuse at future checkouts
 * @access  Private
 */
const updateAddress = async (req, res) => {
  const { name, phone, addressLine, pincode, city, state, landmark } = req.body;

  req.user.address = { name, phone, addressLine, pincode, city, state, landmark };
  await req.user.save();

  res.json(req.user);
};

/**
 * @route   PUT /api/auth/whatsapp
 * @desc    Update the logged-in customer's promotional WhatsApp opt-in + number
 *          (edited from the storefront's Profile page, or set at registration).
 *          Records whatsappOptInDate as a consent timestamp whenever opt-in newly
 *          turns on - left untouched on opt-out, so it stays a record of last consent.
 * @access  Private
 */
const updateWhatsAppPreference = async (req, res) => {
  const { whatsappOptIn, whatsappNumber } = req.body;
  const optingIn = Boolean(whatsappOptIn);
  const wasOptedIn = req.user.whatsappOptIn;

  req.user.whatsappOptIn = optingIn;
  req.user.whatsappNumber = optingIn ? whatsappNumber || "" : "";
  if (optingIn && !wasOptedIn) {
    req.user.whatsappOptInDate = new Date();
  }

  await req.user.save();
  res.json(req.user);
};

module.exports = { registerUser, loginUser, getMe, refreshToken, updateAddress, updateWhatsAppPreference };
