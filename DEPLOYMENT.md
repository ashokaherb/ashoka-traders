# Deployment Guide

This guide walks through taking Ashoka Traders from your local machine to a live,
publicly-reachable site. There are three separate deployables:

```
/backend      -> a long-running Node.js server   -> Render (Web Service)
/storefront   -> a static Vite build              -> Vercel (project 1)
/admin        -> a static Vite build              -> Vercel (project 2)
```

Deploy them in this order - each step needs a URL from the one before:
**MongoDB Atlas -> backend on Render -> storefront + admin on Vercel -> point the backend's
CORS at the Vercel URLs.**

---

## 1. MongoDB Atlas (production database)

1. Create a free account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   if you don't already have one from local dev.
2. Create a **new cluster** dedicated to production - don't reuse the database you've been
   developing against, so test data/orders never mix with real customer data.
3. **Database Access** -> add a database user with a strong, generated password (not the
   one from your dev `.env`).
4. **Network Access** -> allowlist your Render service's **outbound IP ranges**. You'll get
   these in step 2.6 below (Render dashboard -> your service -> **Connect** -> **Outbound**).
   Until the backend exists, you can temporarily allow `0.0.0.0/0` - Atlas still requires
   the username/password/connection string - but replace it with Render's ranges once you
   have them. (This is the same allowlist that blocked your laptop when its IP changed.)
5. **Connect** -> "Drivers" -> copy the `mongodb+srv://...` connection string. This becomes
   your production `MONGO_URI`.

---

## 2. Backend on Render

### 2.1 Create the service

1. Make sure the latest code is pushed to GitHub (Render deploys from the repo).
2. At [render.com](https://render.com): **New -> Web Service** -> connect your GitHub account
   -> pick the `ashoka-traders` repository.
3. Settings:
   | Field | Value |
   |---|---|
   | Root Directory | `backend` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Health Check Path | `/api/health` (under **Advanced**) |
   | Instance type | **Starter or above for the live shop** - see the note below |

   `npm install` works on Render because `backend/.npmrc` sets `legacy-peer-deps=true`
   (needed for the Cloudinary upload package). Don't delete that file - without it the
   build fails with an `ERESOLVE` error.

> **Why not the Free instance for the real shop?** Render's free web services
> [spin down after 15 minutes without traffic](https://render.com/docs/free) and take about a
> minute to wake up - the first customer after a quiet spell would see the storefront fail to
> load products or log in until it wakes. Spinning down also resets the in-memory rate-limit
> counters. Free is fine for a test deployment; use a paid instance once real customers arrive.

### 2.2 Environment variables

Under **Environment**, add every variable from `backend/.env.example`, filled in with real
production values (see the pre-launch checklist in `README.md`). Render injects these as
environment variables - you never upload a `.env` file. In particular:

- **`NODE_ENV=production`** - hides internal error details from API responses, switches to
  production logging, and makes the server refuse to start with a weak `JWT_SECRET` or
  missing `STOREFRONT_URL`/`ADMIN_URL`. (For the very first deploy, before the Vercel URLs
  exist, put temporary values like `https://placeholder.vercel.app` in those two, then fix
  them in step 4.)
- **`TRUST_PROXY`** - leave it **unset**. It defaults to `1` in production, which matches
  Render's proxy. You'll confirm this in 2.5.
- Don't add `PORT` - Render sets it automatically, and `server.js` already reads it.

### 2.3 Deploy and check it's healthy

Render builds and starts the service, and gives it a URL like
`https://ashoka-traders-api.onrender.com`. Check:

```bash
curl https://YOUR-SERVICE.onrender.com/api/health
# {"status":"ok","uptime":...,"timestamp":"..."}
```

In the **Logs** tab you should see `Server running on ... (production mode)` and
`MongoDB connected`. `[config warning]` lines point at settings that still need real values
(e.g. Razorpay test keys, missing SMTP).

### 2.4 Seed the admin account (once)

Free instances have no shell, so run the seed scripts **from your own machine** with the
production values temporarily in `backend/.env` (at minimum `MONGO_URI` and `ADMIN_EMAIL`,
with `ADMIN_PASSWORD` left blank):

```bash
cd backend
npm run seed:admin      # creates the admin and prints a random password ONCE - save it
npm run seed:phase2     # default shipping settings + a starter coupon
```

Then put your local development values back in `backend/.env`. (On a paid instance you can
run the same commands in Render's **Shell** tab instead.)

### 2.5 Verify TRUST_PROXY (rate limiting sees real visitor IPs)

The login, register, coupon and contact-form rate limits count attempts **per visitor IP**.
If `TRUST_PROXY` is wrong for Render, either every visitor appears to share Render's proxy
IP (one person's failed logins lock out all your customers), or visitors can fake their IP
in a header and dodge the limits. Render doesn't publish its exact proxy hop count, so check
it once on the live service - it takes two minutes:

1. Render -> **Environment** -> add `DEBUG_IP_ENDPOINT` = `true` -> save (it redeploys).
2. Find your real public IP: open <https://api.ipify.org> in your browser.
3. Run both of these from the same computer:
   ```bash
   curl https://YOUR-SERVICE.onrender.com/api/debug/ip
   curl -H "X-Forwarded-For: 6.6.6.6" https://YOUR-SERVICE.onrender.com/api/debug/ip
   ```
4. Read the `"ip"` field in **both** responses:
   | What you see | Meaning | Fix |
   |---|---|---|
   | Your real IP both times | Correct | Nothing - leave `TRUST_PROXY` unset |
   | A Render/Cloudflare address, not yours | Too few proxies trusted - all visitors would share one IP | Set `TRUST_PROXY=2`, redeploy, re-check |
   | `6.6.6.6` in the second response | Too many trusted - IPs can be faked | Set `TRUST_PROXY` one lower, redeploy, re-check |
5. Or run the check for yourself in one command (same two requests, with the verdict):
   ```bash
   cd backend && npm run verify:trust-proxy -- https://YOUR-SERVICE.onrender.com
   ```
6. **Delete `DEBUG_IP_ENDPOINT`** afterwards and redeploy. (While it's on, the logs show a
   `DEBUG_IP_ENDPOINT is on` warning as a reminder.)

### 2.6 Outbound IPs (Atlas + Brevo)

Render dashboard -> your service -> **Connect** (top right) -> **Outbound** tab lists the IP
ranges your backend's outgoing connections come from. These ranges are
[shared by all services in the same region](https://render.com/docs/outbound-ip-addresses).
Add them to:

- **MongoDB Atlas** -> Network Access (and remove any temporary `0.0.0.0/0`)
- **Brevo** -> Security -> **Authorised IPs** - otherwise order emails fail with
  `525 Unauthorized IP address`, exactly like they did from your laptop. (Brevo accepts
  individual IPs; if a range is too large to enter, you can turn Brevo's IP blocking off
  and rely on the SMTP key, or buy dedicated outbound IPs on Render.)

---

### 2.7 Razorpay webhook (recovers payments the browser never confirms)

Normally the customer's browser calls `/api/orders/razorpay/verify` the instant Razorpay
reports a successful payment, and the order is created. If they close the tab, lose signal
or their phone dies in that second, the money is taken and **no order exists**. The webhook
is Razorpay telling the server directly, so the order is still created.

1. Choose a secret (any long random string) and add it on Render:
   `RAZORPAY_WEBHOOK_SECRET` = that value -> save (it redeploys).
2. Razorpay Dashboard -> **Settings -> Webhooks -> Add New Webhook**:
   | Field | Value |
   |---|---|
   | Webhook URL | `https://YOUR-SERVICE.onrender.com/api/webhooks/razorpay` |
   | Secret | the same value you put on Render |
   | Active events | `payment.captured` |
3. Save, then use Razorpay's **Send test webhook** button. The Render logs should show
   `[RAZORPAY WEBHOOK]`. A real captured payment logs
   `recovered a payment the browser never confirmed -> created`.

Notes:
- Without `RAZORPAY_WEBHOOK_SECRET` the endpoint answers `503` and does nothing - it never
  trusts an unsigned call.
- It is idempotent: duplicate deliveries, or a payment the browser already confirmed, create
  no second order and deduct no stock twice.
- It only acts when Razorpay's amount matches the price this server stored; a mismatch is
  flagged for investigation instead.
- If a session somehow has no shipping address, the payment is marked `needs_manual` and an
  email goes to `ADMIN_EMAIL` - nothing is invented.

---

## 3. Storefront + Admin on Vercel

Both are plain Vite static builds - set up **two separate Vercel projects** from the same
repository, one per folder.

### 3.1 Generate each app's vercel.json (on your computer, before deploying)

Each app's `vercel.json` carries its security headers (Content-Security-Policy etc.) and the
single-page-app rewrite. It's generated from that app's `securityHeaders.js`, because the
CSP must list your real backend address. With your Render URL from step 2.3:

```bash
cd storefront && npm run vercel:config -- https://YOUR-SERVICE.onrender.com/api
cd ../admin   && npm run vercel:config -- https://YOUR-SERVICE.onrender.com/api
cd .. && git add storefront/vercel.json admin/vercel.json && git commit -m "Point CSP at production API" && git push
```

The committed files start out pointing at a placeholder (`your-backend.onrender.com`), so
**skipping this step makes the Vercel build fail** with a message telling you to run it -
on purpose: a CSP with the wrong backend address would make the browser block every API
call and the site wouldn't work at all.

**Re-run it and commit whenever the backend URL changes** (e.g. you attach
`api.yourdomain.com`), or after editing `securityHeaders.js` (e.g. to allow a new
third-party service).

### 3.2 Create the two projects

At [vercel.com](https://vercel.com): **Add New -> Project** -> import the `ashoka-traders`
repository. Do this twice:

| Setting | Storefront project | Admin project |
|---|---|---|
| Root Directory | `storefront` | `admin` |
| Framework Preset | Vite (auto-detected) | Vite (auto-detected) |
| Build Command / Output | defaults (`npm run build` -> `dist`) | defaults |
| Environment Variables | `VITE_API_URL` = `https://YOUR-SERVICE.onrender.com/api`, `VITE_GA_MEASUREMENT_ID` | `VITE_API_URL` = same value |

`VITE_API_URL` must be **exactly** the URL you passed to `npm run vercel:config` - the build
checks that the two match.

Vercel gives each project a URL like `https://ashoka-traders.vercel.app` and
`https://ashoka-traders-admin.vercel.app`.

### 3.3 Verify the security headers are live

Vercel applies `vercel.json` at its edge, so check the real deployment, not just your
local build:

1. **Headers are sent** - for each site (use a deep link, which also tests the rewrite):
   ```bash
   curl -sI https://YOUR-STOREFRONT.vercel.app/product/any-slug | grep -iE "^HTTP|content-security-policy|x-frame-options|x-content-type"
   curl -sI https://YOUR-ADMIN.vercel.app/orders | grep -iE "^HTTP|content-security-policy|x-robots-tag"
   ```
   Expect `HTTP/2 200` (not 404) and a `content-security-policy` whose `connect-src` includes
   your `onrender.com` address. The admin should also show `x-robots-tag: noindex`.
2. **Nothing legitimate is blocked** - open the live storefront in Chrome with DevTools ->
   **Console** open, and go through: home page (banner + category images), a product page,
   log in, add to cart, checkout, choose **Pay Online** so the Razorpay popup opens. There
   should be **no red "Refused to ... because it violates the following Content Security
   Policy directive"** messages coming from your own site. (Messages that appear *inside*
   Razorpay's popup, from addresses like `px-cloud.net`, are Razorpay enforcing its own
   policy - not yours - and don't affect payments.) Repeat for the admin panel: log in,
   open Products, edit a product, Banners, Categories.
3. **Optional second opinion** - paste each site's URL into
   <https://securityheaders.com>; it should grade the CSP and other headers as present.

If the browser does block something legitimate, add its domain to the right list in that
app's `securityHeaders.js`, re-run `npm run vercel:config`, commit, and push.

---

## 4. Point the backend at the live sites

Back in Render -> **Environment**, set:

- `STOREFRONT_URL` = your storefront's Vercel URL (no trailing slash)
- `ADMIN_URL` = your admin panel's Vercel URL

and redeploy. CORS blocks requests from any origin not in that list, so login and checkout
won't work from the live sites until this is done.

---

## 5. Connecting your custom domain

Once you have a real domain (e.g. from Namecheap or GoDaddy), a common layout is:

| Subdomain | Points to |
|---|---|
| `yourdomain.com` / `www` | Storefront (Vercel) |
| `admin.yourdomain.com` | Admin panel (Vercel) |
| `api.yourdomain.com` | Backend (Render) |

For each: add the domain in that platform's dashboard (Vercel: Project -> **Settings ->
Domains**; Render: service -> **Settings -> Custom Domains**), then add the DNS record it
tells you to at your domain registrar. Both issue HTTPS certificates automatically.

After domains are live, update every URL setting and redeploy:
- Render: `STOREFRONT_URL`, `ADMIN_URL`, `BACKEND_PUBLIC_URL`
- Both Vercel projects: `VITE_API_URL` = `https://api.yourdomain.com/api`
- **Both `vercel.json` files:** `npm run vercel:config -- https://api.yourdomain.com/api` in
  each app, commit, push (the Vercel build refuses to deploy until you do)

**About `/sitemap.xml`**: the generated `vercel.json` already proxies
`https://ashokaherbs.com/sitemap.xml` to the backend's live sitemap, which is also what
`storefront/public/robots.txt` points search engines at. If the backend URL changes, re-run
`npm run vercel:config -- <new API URL>` and commit, and the proxy follows.

### The `www` subdomain

`vercel.json` already redirects `www.ashokaherbs.com` to `https://ashokaherbs.com` (308,
keeping the path), but a redirect can only run once the domain actually reaches Vercel:

1. **Vercel** -> storefront project -> **Settings -> Domains** -> **Add** `www.ashokaherbs.com`.
2. **GoDaddy** -> DNS -> add the record Vercel shows (normally `CNAME` `www` ->
   `cname.vercel-dns.com`).
3. Wait for Vercel to show the domain as **Valid Configuration** and issue its certificate.
4. Check all four entry points end up on the apex over HTTPS:
   ```bash
   curl -sI http://ashokaherbs.com      | head -1
   curl -sI https://www.ashokaherbs.com | head -1   # expect 308 -> https://ashokaherbs.com/
   ```
Leave `STOREFRONT_URL` on Render as `https://ashokaherbs.com` (no `www`) - that is the
canonical origin CORS allows, and www traffic is redirected to it before any API call.

---

## 5b. Search engines (Google Search Console + Bing)

The storefront already serves everything the search engines expect - this section is only
the one-time wiring on their side. Do it AFTER the domain is live on HTTPS.

### 5b.1 Verify the domain in Google Search Console

1. <https://search.google.com/search-console> > Add property.
2. Prefer the **Domain** property (`ashokaherbs.com`) - it covers http/https and www in one
   go, and is verified with a TXT record at GoDaddy rather than a file. Use the **URL
   prefix** property only if DNS access isn't available.
3. If you verify with the **HTML file** method instead, the file Google gives you
   (`googleXXXXXXXX.html`) must be saved in `storefront/public/` **and committed**. Vercel
   rebuilds from git, so a file that exists only on your computer disappears at the next
   deploy and verification silently fails.

### 5b.2 Submit the sitemap

Search Console > Sitemaps > enter `sitemap.xml` > Submit.

`https://ashokaherbs.com/sitemap.xml` is rewritten by Vercel to the backend, which builds
it live from the database: homepage, `/shop`, every active product and category by slug,
and the policy pages. Nothing has to be regenerated when the catalogue changes - a new
product appears in the sitemap immediately, with its own `lastmod`.

Repeat at <https://www.bing.com/webmasters> (Bing can import the Search Console property
in one click, which also covers DuckDuckGo).

### 5b.3 Check the structured data and speed

After the deploy, run these two tools against the live URLs (both are free, no login):

| Tool | URL to test | Expect |
|---|---|---|
| [Rich Results Test](https://search.google.com/test/rich-results) | `https://ashokaherbs.com/` | Organization, GroceryStore (local business), WebSite - no errors |
| Rich Results Test | `https://ashokaherbs.com/product/<any-real-slug>` | **Product snippet** with the right price/availability, plus Breadcrumbs |
| Rich Results Test | `https://ashokaherbs.com/category/<any-real-slug>` | Breadcrumbs |
| [PageSpeed Insights](https://pagespeed.web.dev/) | home, a category page, a product page | Core Web Vitals; LCP is the hero/first product image |

A warning about a missing `aggregateRating` or `review` on products is expected and
correct - the shop has no customer-review feature, and inventing review markup is a
structured-data policy violation. Revisit only if reviews are actually built.

### 5b.4 WhatsApp / social link previews - known limit

The storefront is a single-page app: Google runs JavaScript and sees each page's own
title, description and schema, but WhatsApp, Facebook and most chat apps do **not**. They
read the raw HTML, so a shared product link previews with the site-wide card from
`storefront/index.html` (logo, shop name, `og-image.png`) rather than that product's own
photo and price. The link still works and still looks professional.

Giving every product its own preview needs server-side rendering or a prerender service -
a real piece of work, worth doing only if WhatsApp sharing becomes a main sales channel.

---

## 6. Post-deploy checklist

- [ ] `curl https://YOUR-API/api/health` returns `{"status":"ok",...}`
- [ ] Render logs show `(production mode)` and no unexpected `[config warning]` lines
- [ ] `TRUST_PROXY` verified with `/api/debug/ip` (2.5), and `DEBUG_IP_ENDPOINT` removed again
- [ ] Render outbound IPs added to Atlas and Brevo (2.6)
- [ ] Security headers verified on both Vercel sites, no CSP errors in the console (3.3)
- [ ] Storefront: register/log in, browse, add to cart, deep links like `/product/...` load on refresh
- [ ] A test order goes through end-to-end (a small real Razorpay payment, or COD)
- [ ] Order confirmation + admin alert emails actually arrive (not just console logs)
- [ ] Admin panel loads, login works, Dashboard shows real data
- [ ] `sitemap.xml` reachable wherever you routed it, and `robots.txt` serves at the apex
- [ ] Google Search Console property verified and the sitemap submitted (5b)
- [ ] Rich Results Test clean on the homepage, a product page and a category page (5b.3)
- [ ] Google Analytics Realtime shows activity as you browse (and no CSP errors for GA)
- [ ] HTTPS padlock on all three domains (no mixed-content warnings)

See the **Pre-launch checklist** at the bottom of `README.md` for every environment
variable/setting that still needs a real value before this point.
