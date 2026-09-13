# Deployment Guide

This guide walks through taking Ashoka Traders from your local machine to a live,
publicly-reachable site. There are three separate deployables:

```
/backend      -> a long-running Node.js server (needs a host that keeps a process alive)
/storefront   -> a static build (HTML/CSS/JS) - can be hosted almost anywhere
/admin        -> a static build (HTML/CSS/JS) - can be hosted almost anywhere
```

The instructions below use **Railway** for the backend and **Netlify** for the two static
frontends as concrete examples, since both have generous free tiers and a simple CLI/UI -
but the steps translate directly to Render, Fly.io, a plain VPS (DigitalOcean/Linode/AWS
EC2), Vercel, or Cloudflare Pages if you'd rather use one of those instead.

---

## 1. MongoDB Atlas (production database)

1. Create a free account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   if you don't already have one from local dev.
2. Create a **new cluster** dedicated to production - don't reuse the same database you've
   been developing against, so test data/orders never mix with real customer data.
3. **Database Access** -> add a database user with a strong, generated password (not the
   one from your dev `.env`).
4. **Network Access** -> add an IP allowlist entry. For most hosts (Railway, Render, etc.)
   that don't publish fixed IPs, allow `0.0.0.0/0` (anywhere) - Atlas still requires the
   correct username/password/connection string, so this isn't as open as it sounds, but if
   your host does offer static outbound IPs, allowlist those specifically instead.
5. **Connect** -> "Drivers" -> copy the `mongodb+srv://...` connection string. This becomes
   your production `MONGO_URI`.

---

## 2. Backend deployment (Railway example)

1. Push this repo to GitHub if it isn't already there (Railway deploys from a Git repo).
2. At [railway.app](https://railway.app), **New Project -> Deploy from GitHub repo**, and
   point it at this repository with **Root Directory** set to `backend`.
3. Railway auto-detects Node.js and will run `npm install` then `npm start` (already
   defined in `backend/package.json`) - no build step needed for the backend.
4. Under the service's **Variables** tab, add every variable from `backend/.env.example`,
   filled in with real production values (see the checklist in README.md) - Railway
   injects these as environment variables, you don't upload a `.env` file.
   **Set `NODE_ENV=production`** - this hides internal error details from API responses,
   switches to production logging, and makes the server refuse to start with a weak
   `JWT_SECRET` or missing `STOREFRONT_URL`/`ADMIN_URL`. Leave `TRUST_PROXY` unset (it
   defaults to 1, correct for Railway's single proxy); if you later put Cloudflare in front
   of Railway, set it to `2` or rate limits will see Cloudflare's IP instead of visitors'.
5. Railway assigns a public URL like `https://your-app.up.railway.app` - this is your
   backend's address. Under **Settings -> Networking**, you can attach a custom domain
   here too (e.g. `api.yourdomain.com`) once you're ready (see step 5 below).
6. Once deployed, verify it's healthy:
   ```bash
   curl https://your-backend-domain/api/health
   # {"status":"ok","uptime":...,"timestamp":"..."}
   ```
7. Run the one-time seed scripts against production **once**, from your local machine with
   your production `.env` temporarily in place (or via Railway's "Run a command" /
   one-off shell feature, if available on your plan):
   ```bash
   npm run seed:admin      # creates the one admin account
   npm run seed:phase2     # default shipping settings + a starter coupon
   npm run migrate:slugs   # only needed if importing products from an earlier phase
   ```

**VPS alternative** (DigitalOcean/Linode/a bare EC2 instance): install Node.js 18+, clone
the repo, `cd backend && npm install --production`, copy your production `.env` onto the
server (never commit it), and run it under a process manager so it survives reboots and
crashes:
```bash
npm install -g pm2
pm2 start server.js --name ashoka-backend
pm2 save
pm2 startup   # follow its printed instructions to enable on-boot startup
```
Put Nginx (or Caddy) in front of it as a reverse proxy for HTTPS - a VPS gives you no free
TLS certificate on its own, so use [Certbot](https://certbot.eff.org/) (Let's Encrypt) with
Nginx, or Caddy's automatic HTTPS.

---

## 3. Storefront + Admin deployment (Netlify example)

Both are plain Vite static builds - the steps are identical for each, just done twice
(once per app, as two separate Netlify sites).

1. At [netlify.com](https://netlify.com), **Add new site -> Import an existing project**,
   pick this repository.
2. For the **storefront** site:
   - Base directory: `storefront`
   - Build command: `npm run build`
   - Publish directory: `storefront/dist`
   - Environment variables (Netlify -> Site configuration -> Environment variables):
     `VITE_API_URL` (your deployed backend's URL + `/api`, e.g.
     `https://api.yourdomain.com/api`) and `VITE_GA_MEASUREMENT_ID`.
3. Repeat for the **admin** site with base directory `admin`, publish directory
   `admin/dist`, and just `VITE_API_URL` (no GA variable - analytics is storefront-only).
4. Since these are client-side-routed React apps (React Router), add a redirect rule so
   refreshing a deep link (e.g. `/product/basmati-rice`) doesn't 404. Create a file
   `storefront/public/_redirects` (and the same for `admin/public/_redirects`) containing:
   ```
   /*    /index.html   200
   ```
   Netlify picks this up automatically on the next deploy.

   **Security headers are automatic:** every `npm run build` also writes `dist/_headers`
   (Content-Security-Policy and friends - see `buildCsp` in each app's `vite.config.js`),
   built from that site's `VITE_API_URL`. If you add a third-party service later (chat
   widget, another analytics tool, images from a new host), add its domain there, or the
   browser will block it.
5. Once deployed, **update your backend's `.env`** (`STOREFRONT_URL` and `ADMIN_URL`) to
   the real Netlify URLs (or your custom domains, once attached) and redeploy the
   backend - CORS blocks requests from any origin not in that allowlist, so this step is
   required before login/checkout will work from the live sites.

**Alternative: serve the frontends from the backend itself** (simplest single-host setup,
no separate static hosting needed): build both apps (`npm run build` in each), then in
`backend/server.js` add something like:
```js
app.use("/", express.static(path.join(__dirname, "../storefront/dist")));
app.use("/admin", express.static(path.join(__dirname, "../admin/dist")));
```
This avoids CORS entirely (same origin) but means redeploying the backend every time a
frontend changes, and the admin panel being reachable at a guessable `/admin` path on your
main domain - a separate subdomain (see below) is generally the cleaner choice.

---

## 4. Connecting your custom domain

Once you have a real domain (e.g. from Namecheap, GoDaddy, Google Domains, etc.), a common
layout is:

| Subdomain              | Points to         |
|-------------------------|--------------------|
| `yourdomain.com` / `www` | Storefront (Netlify) |
| `admin.yourdomain.com`  | Admin panel (Netlify) |
| `api.yourdomain.com`    | Backend (Railway)  |

For each: in your DNS provider, add the CNAME (or A record, per that host's instructions)
your hosting platform tells you to add, then add the custom domain in that platform's
dashboard (Railway's Networking tab / Netlify's Domain settings) and wait for it to verify
and issue an HTTPS certificate (usually automatic and free on both platforms).

After domains are live, update every `.env` that references a URL to the real domains
instead of `localhost`/the platform-assigned URLs:
- `backend/.env`: `STOREFRONT_URL`, `ADMIN_URL`, `BACKEND_PUBLIC_URL`
- `storefront/.env` (on Netlify): `VITE_API_URL`
- `admin/.env` (on Netlify): `VITE_API_URL`

And redeploy all three so the changes take effect.

**About `/sitemap.xml`**: it's served by the backend (e.g.
`api.yourdomain.com/sitemap.xml`), but search engines expect it at your storefront's own
domain root (`yourdomain.com/sitemap.xml`). Either:
- add a redirect/rewrite rule at your storefront's host (Netlify supports this via
  `storefront/public/_redirects`: `/sitemap.xml https://api.yourdomain.com/sitemap.xml 200`), or
- submit `api.yourdomain.com/sitemap.xml` directly in Google Search Console - it accepts a
  sitemap on a different subdomain as long as you verify ownership of that subdomain too.

---

## 5. Post-deploy checklist

- [ ] `curl https://api.yourdomain.com/api/health` returns `{"status":"ok",...}`
- [ ] Storefront loads, you can register/log in, browse, add to cart
- [ ] A test order goes through (use a small real payment via Razorpay, or COD, to confirm
      the full path end-to-end before announcing the site is live)
- [ ] Order confirmation + admin alert emails actually arrive (not just console logs)
- [ ] Admin panel loads at its own domain, login works, Dashboard shows real data
- [ ] `https://yourdomain.com/sitemap.xml` (or wherever you routed it) returns valid XML
- [ ] Google Analytics Realtime report shows activity as you browse the live site
- [ ] HTTPS padlock shows on all three domains (no mixed-content warnings)

See the **Pre-launch checklist** at the bottom of `README.md` for every environment
variable/setting that still needs a real value before this point.
