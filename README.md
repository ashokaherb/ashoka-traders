# Ashoka Traders - E-commerce Monorepo

A MERN stack e-commerce project for a small Indian retail shop, with two customer-facing
apps and one shared API:

```
/backend      Node.js + Express + MongoDB (Mongoose) REST API
/storefront   React (Vite) - customer-facing store
/admin        React (Vite) - admin panel (single admin account)
```

**Phase 1** built auth (customer + admin) and product/category CRUD.
**Phase 2** added guest cart, login-gated checkout, address + pincode autofill, coupon
codes, shipping rules, COD + Razorpay payment, order emails, "My Orders", and admin order
management.
**Phase 3** added offers/sale banners with automatic price discounting, wishlist, "notify
me" on restock, related products, admin bulk CSV stock upload, low-stock alerts, an admin
sales dashboard with charts, order CSV export, manual payment-status control, and a
storefront footer with legal pages.
**Phase 4** (this version, final) adds: an admin Store Settings page (shipping, minimum
order value, store/GST info) and Coupon management UI, a minimum-order-value check at
checkout, GST/plain PDF invoices, SEO (product/category slugs, per-page meta tags,
sitemap.xml, compressed images, lazy loading), Google Analytics (storefront only), and
deployment prep (see [DEPLOYMENT.md](DEPLOYMENT.md)). **The project is now feature-complete
per the PRD** - see the pre-launch checklist at the bottom of this file before going live.

---

## Prerequisites

- Node.js 18+ and npm
- A MongoDB instance - either:
  - Local MongoDB running on `mongodb://127.0.0.1:27017`, or
  - A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (use its connection string instead)

---

## 1. Backend setup

```bash
cd backend
npm install
copy .env.example .env      # on Windows (use "cp" on Mac/Linux)
```

Open `.env` and fill in real values (at minimum `MONGO_URI` and `JWT_SECRET`).
`ADMIN_EMAIL` / `ADMIN_PASSWORD` are the credentials for the one admin account.

Create the admin account (run once, safe to re-run):

```bash
npm run seed:admin
```

Seed Phase 2's default shipping settings and a sample coupon (also safe to re-run):

```bash
npm run seed:phase2
```

This creates a `WELCOME10` coupon (10% off) and a shipping rule (free shipping at ₹999+,
otherwise a flat ₹49 fee) - handy for testing checkout immediately.

If you're upgrading a Phase 1-3 database to Phase 4, run this **once** to regenerate
existing products' slugs into the new clean style (e.g. `basmati-rice` instead of the old
`basmati-rice-mtxe7cqw`) - new products get a clean slug automatically, this is only for
ones that already existed:

```bash
npm run migrate:slugs
```

To take **online payments**, add your Razorpay **test mode** keys to `.env`
(`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`, from your Razorpay dashboard's Settings > API
Keys). Without them, the Razorpay payment option will show a clear error instead of
working - COD still works regardless.

To actually **send** order emails instead of just logging them to the console, fill in
`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` in `.env`.

`BACKEND_PUBLIC_URL` should be the backend's own publicly-reachable URL (default
`http://localhost:5000` works for local dev) - it's used to build full URLs for uploaded
product images, since the storefront/admin apps run on a different origin.

Start the API in dev mode (auto-restarts on file changes):

```bash
npm run dev
```

The API runs at **http://localhost:5000** by default. Visit http://localhost:5000/ in a
browser - you should see `{"message":"Ashoka Traders API is running"}`.

### Backend API reference

| Method | Route                       | Access       | Description                     |
|--------|-----------------------------|--------------|----------------------------------|
| POST   | /api/auth/register          | Public       | Register a customer              |
| POST   | /api/auth/login             | Public       | Log in (customer or admin)       |
| GET    | /api/auth/me                | Private      | Get current logged-in user       |
| PUT    | /api/auth/address           | Private      | Save/update the customer's address |
| GET    | /api/categories             | Public       | List categories                  |
| GET    | /api/categories/:id         | Public       | Get one category                 |
| POST   | /api/categories             | Admin only   | Create category                  |
| PUT    | /api/categories/:id         | Admin only   | Update category                  |
| DELETE | /api/categories/:id         | Admin only   | Delete category                  |
| GET    | /api/products               | Public       | List products (`?category=`, `?search=`) |
| GET    | /api/products/:id           | Public       | Get one product (by Mongo id - used internally/by admin) |
| GET    | /api/products/slug/:slug     | Public       | Get one product by its SEO-friendly slug (what the storefront uses) |
| POST   | /api/products               | Admin only   | Create product                   |
| POST   | /api/upload                  | Admin only   | Upload up to 6 images (field name `images`) to Cloudinary, returns their URLs |
| PUT    | /api/products/:id           | Admin only   | Update product                   |
| DELETE | /api/products/:id           | Admin only   | Delete product                   |
| GET    | /api/settings               | Public       | Get store settings (shipping, minimum order, store/GST info) |
| PUT    | /api/settings               | Admin only   | Update store settings            |
| POST   | /api/coupons/validate       | Private      | Check a coupon code against a subtotal |
| GET/POST/PUT/DELETE /api/coupons | Admin only | Manage coupons              |
| GET    | /api/utils/pincode/:pincode | Public       | India Post pincode -> city/state proxy |
| POST   | /api/orders                 | Private      | Place a COD order                |
| POST   | /api/orders/razorpay        | Private      | Create a Razorpay order for the cart |
| POST   | /api/orders/razorpay/verify | Private      | Verify payment signature, then create the order |
| GET    | /api/orders/my              | Private      | The logged-in customer's orders  |
| GET    | /api/orders/:id             | Private      | One order (its owner or admin)   |
| GET    | /api/orders                 | Admin only   | All orders                       |
| GET    | /api/orders/export           | Admin only   | Download all orders as CSV (`?startDate=&endDate=`) |
| PUT    | /api/orders/:id/status      | Admin only   | Update order status, payment status, and/or tracking number |
| GET    | /api/offers/active           | Public       | Currently-active offers (storefront banner) |
| GET/POST/PUT/DELETE /api/offers | Admin only | Manage offers/banners            |
| GET    | /api/wishlist                | Private      | The logged-in customer's wishlist |
| POST/DELETE /api/wishlist/:productId | Private | Add/remove a product from the wishlist |
| GET    | /api/products/:id/related     | Public       | Up to 6 related products (same category) |
| POST   | /api/products/:id/notify      | Private      | Ask to be emailed when back in stock |
| POST   | /api/products/bulk-upload     | Admin only   | Bulk-update stock/price via CSV upload |
| GET    | /api/dashboard                | Admin only   | Order/revenue stats, top sellers, low stock, recent orders |
| GET    | /api/orders/:id/invoice       | Private      | Download a PDF invoice (GST or plain) - owner or admin |
| GET    | /api/health                   | Public       | Health check (uptime monitors, hosting platforms) |
| GET    | /sitemap.xml                  | Public       | XML sitemap of all category/product pages (not under `/api`) |

Admin-only routes need `Authorization: Bearer <token>` from an admin login.

---

## 2. Storefront setup (customer store)

```bash
cd storefront
npm install
copy .env.example .env
npm run dev
```

Runs at **http://localhost:5173**. Make sure the backend is running first, and that
`storefront/.env`'s `VITE_API_URL` points at it (default already matches).

Pages: Home / Category (offer banner + product grid + category filter + search, each
category has its own clean `/category/:slug` URL), Register, Login, Product detail (clean
`/product/:slug` URL, add to cart, wishlist heart, notify-me, related products, per-page
SEO title/description), Cart, Checkout (address + pincode autofill + coupon + minimum-order
check + COD/Razorpay), Order Success (+ Download Invoice), My Orders (+ Download Invoice),
My Wishlist, About/Contact/Terms/Privacy/Returns (footer links, shown on every page).

To enable **Google Analytics**, set `VITE_GA_MEASUREMENT_ID` in `storefront/.env` to your
GA4 Measurement ID (e.g. `G-XXXXXXXXXX`) - leave it blank to keep analytics fully disabled.
It's never loaded in the admin app.

**How the guest cart works:** the cart lives in `localStorage`, not on the server, so
browsing and adding to cart never requires login. Clicking "Proceed to Checkout" is the
only point login/registration is required - after signing in you're sent straight back to
checkout with the same cart intact (nothing is lost or needs "merging", since the cart
was never tied to an account in the first place).

---

## 3. Admin panel setup

```bash
cd admin
npm install
copy .env.example .env
npm run dev
```

Runs at **http://localhost:5174**. Log in with the admin email/password you set in
`backend/.env` (and created via `npm run seed:admin`).

Pages: Login, **Dashboard** (default landing page - order/revenue stats, 7-day revenue
chart, top sellers, low stock, recent orders), Product list, Add/Edit product (with
optional variants, image upload, and a low-stock threshold), Category management, Offers
&amp; Banners, **Coupons** (create/edit/activate/deactivate/delete), Bulk Stock Upload,
Orders list (with CSV export), Order detail (update order status, payment status, tracking
number, and Download Invoice), **Settings** (shipping rule, minimum order value, store
name, GST number, support email/phone).

---

## Running everything locally (3 terminals)

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd storefront && npm run dev

# Terminal 3
cd admin && npm run dev
```

### Testing the Phase 2 flow (cart -> checkout -> orders)

1. Open http://localhost:5174, log in as admin, add a category and a product (give it a
   variant like "500g"/"1kg" to test that path too).
2. Open http://localhost:5173 in a fresh/incognito window (so you start logged out).
   Browse Home, add the product to your cart, adjust quantity - all without logging in.
3. Click **Cart** -> **Proceed to Checkout**. You'll be sent to Login/Register - do either
   one, and you'll land straight back on Checkout with your cart intact.
4. Fill in the address (type a real 6-digit pincode and tab out - city/state should
   auto-fill), try the coupon code **WELCOME10**, pick COD or Razorpay, and place the order.
   - COD confirms immediately.
   - Razorpay opens a real test-mode checkout popup - use card `4111 1111 1111 1111`, any
     future expiry, any CVV, and any OTP to simulate a successful payment.
5. You'll land on the Order Success page. Check **My Orders** on the storefront - the
   order should be there.
6. Back in the admin panel, go to **Orders**, open the order, change its status (e.g. to
   "Packed") and add a tracking number, then save.
7. Check the backend's terminal output - you should see the order confirmation and
   admin-alert emails logged there (unless you configured real SMTP credentials).

### Testing each Phase 3 feature

**1. Create an offer / sale banner**
- Admin -> **Offers & Banners** -> fill in a title (e.g. "Flat 20% off on Grocery!"),
  a discount %, and pick "All products" or a specific category -> **Create Offer**.
- Open the storefront Home page - a scrolling green banner should appear at the top.
- Open any product in that category (or any product, if you chose "All products") - its
  price now shows struck-through original + discounted price, and the same discount is
  applied at actual checkout (verify the order total reflects it, not just the display).
- Back in Offers & Banners, untick **Active** - the banner and discount disappear
  immediately (no need to delete the offer).

**2. Wishlist**
- As a logged-in customer, click the heart icon (♡) on any product card or the product
  detail page - it fills in red (♥) and the product appears on **My Wishlist** (navbar link).
- Click the heart again (either place) to remove it.
- Try clicking the heart while logged out - it redirects to Login and drops you right back
  where you were once you sign in.

**3. Notify Me**
- In the admin panel, edit a product and set its stock (and every variant's stock, if any)
  to **0** -> Save.
- On the storefront, open that product - "Add to Cart" is replaced with **Notify Me**.
  Click it (while logged in) - it confirms and disables itself.
- Back in the admin panel, edit the same product and set stock back above 0 -> Save.
- Check the backend terminal - a "back in stock" email should be logged there for that
  customer, and clicking Notify Me on that product again now shows "Notify Me" fresh
  (the request list was cleared after emailing).

**4. Related products**
- Add two or more products to the same category, then open one of them on the storefront -
  a "You may also like" row appears below showing the others.

**5. Bulk stock upload**
- Admin -> **Bulk Upload** -> click "Download current products as CSV template" (it's
  pre-filled with each product's real `productId`, name, stock, and price).
- Edit a few stock/price numbers in the CSV, save it, then upload it back through the form.
- You'll see a summary: how many rows updated, and how many failed with a reason (try
  editing a row to have a bogus `productId` or a non-numeric stock value to see a
  clean failure message rather than a crash).
- The regular Add/Edit Product form still works exactly as before, alongside this.

**6 & 7. Low-stock alerts and the sales dashboard**
- Log into the admin panel - **Dashboard** is now the landing page.
- Edit a product so its stock is at or below its "Low Stock Alert Threshold" (default 5,
  editable per-product in Add/Edit Product) - it should appear in the Dashboard's
  **Low Stock** widget.
- Place a few orders from the storefront (COD is fastest) - Dashboard's order/revenue
  counters, the 7-day revenue chart, Top 5 Best-Selling Products, and Recent Orders should
  all update to reflect them.

**8. Order export**
- Admin -> **Orders** -> **Export as CSV** - downloads a CSV of every order (id, customer,
  items, total, payment method, status, date). Open it in Excel/Sheets to confirm the columns.

**9. Manual payment status**
- Admin -> **Orders** -> open any order -> the **Payment Status** dropdown
  (pending/paid/refund_requested/refunded) is separate from Order Status. Set it to
  "refund_requested" and save - the customer will see that reflected in their "My Orders"
  the next time they check (actual refunds are still processed manually in your Razorpay
  dashboard - this is just the status label shown to the customer).

**10. Footer + legal pages**
- Scroll to the bottom of any storefront page - the footer (About/Contact/Policies/social
  placeholders/payment icons) is on every page.
- Click through About Us, Contact Us, Terms & Conditions, Privacy Policy, and
  Cancellation & Returns - all placeholder text for you to fill in later.
- On "My Orders", each order's expanded detail shows a "Contact us" link instead of a
  self-service cancel button, same as the Returns page.

### Testing each Phase 4 feature

**1. Store Settings page**
- Admin -> **Settings** -> change the store name, shipping numbers, or support
  email/phone -> **Save Settings**. Reload the page - the saved values should still be
  there (it's editing the one Settings document, creating it on first save if needed).

**2. Coupon management UI**
- Admin -> **Coupons** -> create one (e.g. code `SAVE50`, flat ₹50 off) -> it appears in
  the list. Untick **Active** - it's now deactivated. Try applying it at storefront
  checkout - it should be rejected as "Invalid or inactive coupon code". Reactivate it and
  it works again. Edit and delete both work the same way as Offers.

**3. Minimum order value**
- Admin -> **Settings** -> set **Minimum Order Value** to something above your cart's
  current subtotal (e.g. 5000) -> Save.
- On the storefront, go to Checkout with a smaller cart - the "Place Order" button is
  replaced with a disabled "Add more to checkout" and a message showing exactly how much
  more is needed. Set it back to 0 to remove the minimum.

**4. GST / plain invoice**
- With **Settings -> GST Number** left blank, download an invoice from My Orders/Order
  Success/admin Order Detail - it's headed "RECEIPT".
- Set a GST Number (e.g. `22AAAAA0000A1Z5`) and save, then download the invoice for the
  same order again - it's now headed "TAX INVOICE" and shows the GSTIN.

**5. SEO - slugs, sitemap, meta tags**
- Look at a product's URL - it should read like `/product/basmati-rice`, not a raw id.
  Same for a category via the category filter - `/category/grocery`.
- View the page source (or your browser's dev tools) on Home and a product page - the
  `<title>` and meta description should differ per page.
- Visit http://localhost:5000/sitemap.xml directly - it lists your storefront's home,
  category, and product URLs.

**6. Compressed images + lazy loading**
- Admin -> Add/Edit Product -> use the new file input under "Image URLs" to upload an
  image directly (instead of pasting a URL) - it appears in the field automatically once
  processed, and opening that URL directly shows a compressed `.webp` file.
- On the storefront Home page with many products, open dev tools' Network tab and scroll -
  images below the fold only start loading as they scroll into view.

**7. Google Analytics**
- With `VITE_GA_MEASUREMENT_ID` blank, GA is fully inactive (check the Network tab - no
  request to googletagmanager.com). Set it to a real GA4 Measurement ID, restart
  `npm run dev`, and you should see the gtag.js request and page_view events firing as you
  navigate between pages, visible in your GA4 property's Realtime report.

**8. Deployment prep**
- See [DEPLOYMENT.md](DEPLOYMENT.md) for the full step-by-step guide, and the checklist at
  the bottom of this file for what to fill in before going live.

---

## Project notes / design decisions

- **One User model** for both customers and the admin, distinguished by `isAdmin`. There is
  intentionally only one admin account, created via `backend/seed/seedAdmin.js` - there is
  no "become admin" API route.
- **Product variants** (e.g. 500g / 1kg) are an optional array on each product. If empty,
  the storefront just uses the product's base price/stock.
- **Images** are stored as an array of URL strings for now (paste a hosted image URL in the
  admin form). Real file upload can be added later without changing the schema.
- **Tailwind CSS** is used in both frontend apps for quick, clean styling.
- Each frontend app has its own `.env` (`VITE_API_URL`) pointing at the backend, and its own
  `localStorage` token key (`token` for storefront, `adminToken` for admin) so a browser
  logged into both won't have the sessions collide.
- **Order pricing is always recomputed server-side.** The cart only sends `productId` /
  `variantId` / `quantity` to the backend - never a price. This is what makes the "reject
  order if quantity exceeds stock" and coupon/shipping rules tamper-proof.
- **Stock is only deducted once an order is confirmed** - COD deducts immediately; Razorpay
  deducts only after the payment signature is verified, never when the checkout popup is
  merely opened. This means two shoppers could still both attempt to buy the last unit
  during the brief window before either one pays - acceptable for this phase's scope, but
  worth knowing about.
- **Coupons and the shipping rule still have no admin UI page** - they're managed via
  `npm run seed:phase2` or directly through their admin-only API routes. That UI (alongside
  more advanced offers/banner tooling) can come in a later phase if you want it.
- The India Post tracking link on "My Orders" goes to India Post's general tracking page
  (it doesn't deep-link with the number pre-filled - customers paste it there themselves).
- **Offer discounts apply everywhere prices are shown or charged** - product cards, the
  product page, the wishlist, and the actual order total at checkout all use the same
  server-computed `effectivePrice`, so what a customer sees is always what they pay.
- **A category-specific offer always wins over a storewide "all" offer** if both are active
  at once; among same-scope offers, the bigger discount wins. Only one offer ever applies
  per product (they don't stack).
- **Bulk CSV upload only touches a product's base `stock`/`price`, not its variants.** For a
  product with variants (e.g. 500g/1kg), edit those through the regular Add/Edit Product
  form - the CSV path is meant for simple, no-variant restocking at volume.
- **"Notify Me" is tracked per-product, not per-variant** - it fires once anything about the
  product becomes purchasable again (i.e. the base stock or any one variant's stock is
  above 0), not necessarily the exact variant that was out of stock when they clicked it.
- **The Dashboard's low-stock and top-sellers logic runs in Node on each request** rather
  than being pre-computed/cached - completely fine at a small shop's scale, but worth
  knowing if the product/order catalog ever grows large.
- **Minimum order value is checked against subtotal** (same as the free-shipping
  threshold), before shipping/discount are applied, and is enforced on the backend
  regardless of what the storefront's own check shows - it can't be bypassed by calling
  the API directly.
- **Product slugs are generated automatically** from the name and only change when the
  name changes; a collision (two products that would slugify to the same thing) appends
  `-2`, `-3`, etc. Existing products from before Phase 4 keep their old-style slug until
  you run `npm run migrate:slugs` once.
- **Product images are uploaded straight to Cloudinary** (see `backend/config/cloudinary.js`
  and `backend/middleware/cloudinaryUpload.js`) rather than stored on the backend's own
  disk - nothing to lose on a redeploy, and it already works fine behind multiple backend
  instances/a load balancer. Cloudinary resizes to max 1000px wide and auto-picks the best
  format/quality per viewer. Requires a free Cloudinary account and its three API values in
  `.env` (`CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`) - see
  `.env.example`.
- **The sitemap route lives at the backend's own `/sitemap.xml`**, not under `/api` - if
  your production storefront and backend are on different domains, you'll want your
  hosting/DNS setup to make `yourdomain.com/sitemap.xml` reach the backend (see
  DEPLOYMENT.md) so search engines find it at the domain they're actually crawling.
- **Google Analytics is storefront-only by design** - `GoogleAnalytics.jsx` is never
  imported in the admin app, so admin activity is never tracked.

## Pre-launch checklist

The app is feature-complete per the PRD. Before taking it live, here's everything that
still needs your real values (everything below currently either uses test data or is
simply unset):

- [ ] **MongoDB Atlas** - create a production cluster (or a separate production database on
      your existing one), and put its connection string in the production `backend/.env`'s
      `MONGO_URI`. Don't reuse your dev database for production data.
- [ ] **JWT_SECRET** - generate a fresh long random string for production (don't reuse the
      dev one). `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
      generates one.
- [ ] **Admin account** - set a real `ADMIN_EMAIL`/strong `ADMIN_PASSWORD` in the production
      `.env` before running `npm run seed:admin` there (not `changeme123`).
- [ ] **Razorpay live keys** - swap `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` from test mode to
      your live-mode keys (Razorpay dashboard, once your account is activated for live
      payments).
- [ ] **Real SMTP credentials** - set `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/
      `EMAIL_FROM` so order/notify-me emails actually send instead of only logging to the
      console. A transactional email provider (SendGrid, Mailgun, Amazon SES, etc.) is more
      reliable than a personal Gmail account for this.
- [ ] **Google Analytics ID** - create a GA4 property and set `VITE_GA_MEASUREMENT_ID` in
      `storefront/.env`.
- [ ] **GST number** - set it in Admin -> Settings once you have it, so invoices generate as
      proper GST Tax Invoices (leave blank if you're not GST-registered).
- [ ] **Store info** - fill in Admin -> Settings' store name, support email, and support
      phone; fill in the real values in ContactUs.jsx's placeholder phone/email/WhatsApp/
      address, and the placeholder social links in Footer.jsx.
- [ ] **Legal pages** - replace the placeholder text in About Us, Terms & Conditions,
      Privacy Policy, and Cancellation & Returns with your actual policies.
- [ ] **Domain + hosting** - pick and configure hosting for the backend and both frontend
      builds, and point your custom domain(s) at them (see DEPLOYMENT.md for step-by-step
      instructions).
- [ ] **Production env vars everywhere** - `STOREFRONT_URL`/`ADMIN_URL` (backend CORS),
      `BACKEND_PUBLIC_URL`, and each frontend's `VITE_API_URL` all need to point at your
      real production domains, not `localhost`.
- [ ] **`npm run migrate:slugs`** - run once against the production database if it already
      has products from an earlier phase.
- [ ] **Shipping/coupon defaults** - review `npm run seed:phase2`'s defaults (₹999 free
      shipping threshold, ₹49 flat fee, `WELCOME10` coupon) and adjust or remove them via
      Admin -> Settings/Coupons for what you actually want live.

**This was the last planned phase - the project is ready for deployment once the checklist
above is done.** Anything past this (further features, redesigns, etc.) would be a new
phase you define when you're ready.
