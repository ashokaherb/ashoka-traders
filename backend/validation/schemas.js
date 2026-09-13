const { z } = require("zod");
const mongoose = require("mongoose");

// Request-body schemas for the write endpoints that take user input (audit L1).
// Used through middleware/validate.js in the route files. Unknown fields are stripped.
// Error messages are shown to customers/admins as-is, so they say how to fix the problem.

// --- Building blocks ----------------------------------------------------------------------

const text = (label, max) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} must be text` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

const optionalText = (label, max) =>
  z
    .string({ invalid_type_error: `${label} must be text` })
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .optional();

const email = z
  .string({ required_error: "Email is required", invalid_type_error: "Email must be text" })
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .email("Enter a valid email address");

// Indian mobile number. Spaces/dashes are allowed while typing ("98765 43210", "+91-98765-43210");
// what matters is 10 digits, optionally prefixed with 91 / +91.
const PHONE_RE = /^(\+?91)?[6-9]\d{9}$/;
const isPhone = (value) => PHONE_RE.test(value.replace(/[\s-]/g, ""));
const phone = z
  .string({ required_error: "Phone number is required", invalid_type_error: "Phone number must be text" })
  .trim()
  .refine(isPhone, "Enter a valid 10-digit mobile number");
const optionalPhone = z
  .string({ invalid_type_error: "Phone number must be text" })
  .trim()
  .refine((v) => v === "" || isPhone(v), "Enter a valid 10-digit mobile number")
  .optional();

const objectId = (label) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is invalid` })
    .refine((v) => mongoose.isValidObjectId(v), `${label} is invalid`);

const money = (label) =>
  z
    .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
    .finite(`${label} must be a number`)
    .min(0, `${label} can't be negative`)
    .max(10000000, `${label} is too large`);

const wholeNumber = (label, max = 1000000) =>
  z
    .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} can't be negative`)
    .max(max, `${label} is too large`);

// --- Auth -----------------------------------------------------------------------------------

const register = z.object({
  name: text("Name", 100),
  email,
  password: z
    .string({ required_error: "Password is required", invalid_type_error: "Password must be text" })
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be at most 128 characters"),
  phone: optionalPhone,
  whatsappOptIn: z.boolean({ invalid_type_error: "WhatsApp opt-in must be true or false" }).optional(),
  whatsappNumber: optionalPhone,
});

// Login deliberately doesn't check password rules - old accounts must still be able to log in.
const login = z.object({
  email,
  password: z
    .string({ required_error: "Password is required", invalid_type_error: "Password must be text" })
    .min(1, "Password is required")
    .max(128, "Invalid email or password"),
});

const whatsappPreference = z.object({
  whatsappOptIn: z.boolean({ required_error: "WhatsApp opt-in is required", invalid_type_error: "WhatsApp opt-in must be true or false" }),
  whatsappNumber: optionalPhone,
});

// --- Address (checkout + saved address) -------------------------------------------------------

const address = z.object(
  {
    name: text("Full name", 100),
    phone,
    addressLine: text("Address", 300),
    pincode: z
      .string({ required_error: "Pincode is required", invalid_type_error: "Pincode must be text" })
      .trim()
      .regex(/^\d{6}$/, "Pincode must be 6 digits"),
    city: text("City", 100),
    state: text("State", 100),
    landmark: optionalText("Landmark", 150),
  },
  { required_error: "Shipping address is required", invalid_type_error: "Shipping address is invalid" }
);

// --- Checkout -----------------------------------------------------------------------------------

const cartItems = z
  .array(
    z.object({
      productId: objectId("Product"),
      variantId: objectId("Product option").nullish(),
      quantity: z
        .number({ invalid_type_error: "Quantity must be a number" })
        .int("Quantity must be a whole number")
        .min(1, "Quantity must be at least 1")
        .max(999, "Quantity is too large"),
    }),
    { required_error: "Cart is empty", invalid_type_error: "Cart is invalid" }
  )
  .min(1, "Cart is empty")
  .max(50, "Too many different items in one order");

const couponCode = z.string({ invalid_type_error: "Coupon code must be text" }).trim().max(30).nullish();

const codOrder = z.object({
  items: cartItems,
  address,
  couponCode,
  paymentMethod: z.literal("COD", { errorMap: () => ({ message: "Use /api/orders/razorpay for online payment" }) }),
});

const razorpayOrder = z.object({ items: cartItems, couponCode });

const razorpayVerify = z.object({
  razorpay_order_id: text("Payment reference", 100),
  razorpay_payment_id: text("Payment reference", 100),
  razorpay_signature: text("Payment signature", 200),
  items: cartItems,
  address,
  couponCode,
});

// --- Contact form ---------------------------------------------------------------------------------

const contact = z.object({
  name: text("Name", 100),
  email,
  phone: optionalPhone,
  message: text("Message", 2000),
});

// --- Products (admin) -------------------------------------------------------------------------------

const variant = z.object({
  label: text("Option label", 50),
  price: money("Option price"),
  stock: wholeNumber("Option stock"),
});

const productFields = {
  name: text("Name", 200),
  description: optionalText("Description", 5000),
  price: money("Price"),
  category: objectId("Category"),
  stock: wholeNumber("Stock"),
  variants: z.array(variant).max(30, "At most 30 options per product"),
  images: z
    .array(z.string().trim().url("Each image must be a valid URL").max(500))
    .max(10, "At most 10 images per product"),
  hsnCode: z
    .string({ invalid_type_error: "HSN code must be text" })
    .trim()
    .regex(/^(\d{4}|\d{6}|\d{8})?$/, "HSN code must be 4, 6 or 8 digits"),
  lowStockThreshold: wholeNumber("Low stock threshold"),
  isNewArrival: z.boolean({ invalid_type_error: "New arrival must be true or false" }),
  isActive: z.boolean({ invalid_type_error: "Active must be true or false" }),
  rating: z.number({ invalid_type_error: "Rating must be a number" }).min(0).max(5, "Rating must be between 0 and 5"),
  reviewCount: wholeNumber("Review count"),
};

// Create: name/price/category required, the rest optional (model defaults apply).
const productCreate = z.object({
  ...Object.fromEntries(Object.entries(productFields).map(([key, schema]) => [key, schema.optional()])),
  name: productFields.name,
  price: productFields.price,
  category: productFields.category,
});

// Update: every field optional - only the ones sent are changed. At least one is needed.
const productUpdate = z
  .object(Object.fromEntries(Object.entries(productFields).map(([key, schema]) => [key, schema.optional()])))
  .refine((body) => Object.keys(body).length > 0, "Nothing to update");

// --- Coupons (admin) -------------------------------------------------------------------------------

const couponFields = {
  code: z
    .string({ required_error: "Coupon code is required", invalid_type_error: "Coupon code must be text" })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,20}$/, "Coupon code must be 3-20 letters, numbers, - or _"),
  discountType: z.enum(["percent", "flat"], { errorMap: () => ({ message: "Discount type must be percent or flat" }) }),
  value: z
    .number({ required_error: "Discount value is required", invalid_type_error: "Discount value must be a number" })
    .finite()
    .positive("Discount value must be more than 0")
    .max(100000, "Discount value is too large"),
  // "" or null = no expiry
  expiryDate: z
    .union([z.literal(""), z.null(), z.coerce.date({ invalid_type_error: "Expiry date is invalid" })])
    .transform((v) => (v === "" ? null : v)),
  minOrderValue: money("Minimum order value"),
  // "" or null = unlimited
  usageLimit: z
    .union([
      z.literal(""),
      z.null(),
      z.number({ invalid_type_error: "Usage limit must be a number" }).int("Usage limit must be a whole number").min(1, "Usage limit must be at least 1"),
    ])
    .transform((v) => (v === "" ? null : v)),
  active: z.boolean({ invalid_type_error: "Active must be true or false" }),
};

const percentAtMost100 = (body) => body.discountType !== "percent" || body.value === undefined || body.value <= 100;

const couponCreate = z
  .object({
    code: couponFields.code,
    discountType: couponFields.discountType,
    value: couponFields.value,
    expiryDate: couponFields.expiryDate.optional(),
    minOrderValue: couponFields.minOrderValue.optional(),
    usageLimit: couponFields.usageLimit.optional(),
    active: couponFields.active.optional(),
  })
  .refine(percentAtMost100, { message: "A percentage discount can't be more than 100%", path: ["value"] });

// usedCount is intentionally absent - it only changes when orders are placed.
const couponUpdate = z
  .object(Object.fromEntries(Object.entries(couponFields).map(([key, schema]) => [key, schema.optional()])))
  .refine((body) => Object.keys(body).length > 0, "Nothing to update");

// --- Order status (admin) ------------------------------------------------------------------------

const ORDER_STATUSES = ["Placed", "Packed", "Shipped", "Delivered", "Cancelled"];
const PAYMENT_STATUSES = ["pending", "paid", "refund_requested", "refunded"];

const orderStatusUpdate = z.object({
  orderStatus: z.enum(ORDER_STATUSES, { errorMap: () => ({ message: `Order status must be one of: ${ORDER_STATUSES.join(", ")}` }) }).optional(),
  paymentStatus: z
    .enum(PAYMENT_STATUSES, { errorMap: () => ({ message: `Payment status must be one of: ${PAYMENT_STATUSES.join(", ")}` }) })
    .optional(),
  trackingNumber: optionalText("Tracking number", 100),
});

module.exports = {
  register,
  login,
  whatsappPreference,
  address,
  codOrder,
  razorpayOrder,
  razorpayVerify,
  contact,
  productCreate,
  productUpdate,
  couponCreate,
  couponUpdate,
  orderStatusUpdate,
  ORDER_STATUSES,
};
