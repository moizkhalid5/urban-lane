# Deploying Urban Lane on Hostinger Shared Hosting

This guide takes the Urban Lane store from this folder to a live site on a **Hostinger shared
web-hosting plan**. It replaces the older `DEPLOYMENT.md` (VPS/zip-era notes).

Prepared and tested on 6 Oct 2026: a production build and `npm start` were run locally and
checked page by page; the database file was test-imported into **MariaDB 10.11** (what Hostinger
shared hosting runs) and the site was run against it.

---

## 0. Can this site run on Hostinger shared hosting?

**Yes, on a plan that includes Hostinger's "Node.js" web apps.** At the time of writing that is
**Business Web Hosting** and the **Cloud** plans (Startup / Professional / Enterprise).
The cheaper **Single** and **Premium** plans only run PHP/static sites and **cannot** run this store.

> Check in hPanel → **Websites → Add website**: if you see a **Node.js** option, your plan can run it.
> If not, upgrade the plan (hPanel → *Upgrade*). Hostinger changes plan features over time, so trust
> what hPanel shows over this note.

### Why not a static or PHP version?

Urban Lane is a **Next.js 15 application that needs a running Node.js server**. These parts only
work with a server and a database:

| Feature | Needs |
|---|---|
| Every product, category, brand, search and filter page | Reads the MySQL database on each request (prices, stock, filters) |
| Bag (cart), checkout, order placement, stock deduction | Server actions + database |
| Register, email verification, login, password reset, account, wishlist | Auth.js sessions + database + email |
| Admin panel (products, orders, inventory, categories, settings, image upload) | Server actions, API route, file storage |
| Sitemap, menu that hides empty categories | Database at request time |

A "static export" would remove all of the above. Re-writing the backend in PHP would mean
rebuilding the cart, checkout, accounts and the whole admin panel. That's weeks of work and a
new set of bugs. **Upgrading to a plan with Node.js is far cheaper and safer**, and no code
needs converting.

---

## 1. What was changed to make the site production-ready

You don't need to do anything for these; they're already in the code.

| Problem found | Fix |
|---|---|
| Images uploaded in **Admin** would not appear on the live site (`next start` only serves files that existed at build time) and would be **deleted by every redeploy** | Uploads now go to a folder you choose **outside** the app (`UPLOAD_DIR`) and are served by a small route at the same `/uploads/...` addresses. Product photos that ship with the code are unaffected. |
| **Customers could not log in**: login requires a verified email, but sending through Hostinger's mail server (SMTP) needed a package that wasn't installed | `nodemailer` installed; sender defaults to your mailbox (Hostinger rejects other "From" addresses). Delivery tested with a real SMTP server. |
| Site **crashed** if the domain was entered without `https://` (common in hPanel) | Domain settings are normalised automatically (`src/lib/site.ts`). |
| Admin/account pages could **loop back to login** behind Hostinger's HTTPS proxy | The login gate now detects the secure session cookie correctly. |
| **Critical security advisories** in Next.js and Auth.js | Updated to Next.js 15.5.27 and Auth.js beta.32. An unused auth package was removed. |
| Live database would have contained a **demo customer with a published password**, 4 test orders and the admin on the **public default password** `ChangeMe123!` | `db-bundle.sql` is built from a cleaned copy: demo customer and test orders removed, admin password replaced with a strong one (given to you separately). |
| Product pages showed **duplicate sizes** ("L" and "Large") and identical grey colour dots | Sizes are shown with one tidy label each; colours get swatches from their names; one product's duplicate stock entries were merged. |

Checked end to end on the production build: home, Men/Women/Kids landing pages, every collection,
filters (size/colour/brand/price/age), brands, search, product pages, add to bag, **guest checkout
with Cash on Delivery → order confirmation**, register → verification email → login → account →
wishlist, admin login and every admin page, admin image upload, 404s, sitemap, robots, and phone
layout. The build also works with **no database connection**, so Hostinger's build step can't fail on that.

---

## 2. What you need before starting

1. A Hostinger plan with **Node.js** (see section 0) and your domain (e.g. `urbanlane.uk`) added to it.
2. The code on **GitHub** (the repo `HaroonBangash/urbane-lane`), including the product images.
   Ask Claude to commit and push, or run:
   ```bash
   git add -A
   git commit -m "Prepare for Hostinger deployment"
   git push origin main
   ```
   The images (`public/uploads/products`, `public/images`) are about 420 MB, so the first push
   and the first Hostinger deploy take a while.
3. `db-bundle.sql` from this folder (about 200 KB). It is **not** on GitHub (it holds the admin
   password hash); you upload it in step 3.
4. The new **admin password** (given to you with this guide). The login email is
   `admin@urbanelane.com`; step 8 switches it to your real address.

---

## 3. Create the database and import the store data

1. hPanel → **Databases → MySQL Databases** (may be labelled *Databases → Management*).
2. Create a database and user. Write down:
   - database name, e.g. `u123456789_urban`
   - user, e.g. `u123456789_urban`
   - password
   - host: usually `localhost` (hPanel shows it; on some plans it's an address like `srv123.hstgr.io`)
3. Click **Enter phpMyAdmin** next to the new database.
4. phpMyAdmin → **Import** → *Choose file* → `db-bundle.sql` → **Import** (leave other options as they are).
5. You should see 24 tables, including `Product`, `Category`, `Brand`, `Banner`,
   `SiteSettings` and `_prisma_migrations`.

> Import into an **empty** database. The file contains 460 products, all categories (with the
> sub-category sorting), brands, banners, rotating strip messages and settings, plus the admin user only.

---

## 4. Create a mailbox for store emails

Customers must verify their email before they can log in, so email has to work from day one.

1. hPanel → **Emails** → create a mailbox on your domain, e.g. `orders@urbanlane.uk`.
2. Note its password. Hostinger's sending settings are:
   - SMTP host: `smtp.hostinger.com`
   - Port: `465` with SSL (`SMTP_SECURE=true`)
   - Username: the full mailbox address

---

## 5. Create a folder for admin uploads

1. hPanel → **Files → File Manager**.
2. In your home folder (the top level, **not** inside `public_html` or the app folder) create a
   folder named `urban-lane-uploads`.
3. Note its full path. File Manager shows it, typically `/home/u123456789/urban-lane-uploads`.

Images uploaded in Admin are saved here, so they survive redeploys.

---

## 6. Create the Node.js app

hPanel → **Websites → Add website → Node.js app** (wording may vary). Choose **Import Git
repository** and connect GitHub, select `urbane-lane`, branch `main`.

Use these settings:

| Setting | Value |
|---|---|
| Framework preset | **Next.js** |
| Node.js version | **22** (matches `.nvmrc` and `package.json`) |
| Root directory | `/` (where `package.json` is) |
| Install command | `npm install` |
| **Build command** | `npx prisma migrate deploy && npm run build` |
| **Start command** | `npm start` |
| Output directory | `.next` |

> The build command first applies any new database changes (it does nothing if there are none),
> then builds the site. The database you imported is already up to date.

### Environment variables

Add these in the app's **Environment variables** section (not in a file):

| Name | Value |
|---|---|
| `DATABASE_URL` | `mysql://DB_USER:DB_PASSWORD@DB_HOST:3306/DB_NAME` (from step 3) |
| `APP_URL` | `https://urbanlane.uk` (your domain) |
| `AUTH_URL` | `https://urbanlane.uk` (same as `APP_URL`) |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_SECRET` | a long random string. Generate one on your PC with `npx auth secret` or at <https://generate-secret.vercel.app/32> |
| `NODE_ENV` | `production` |
| `EMAIL_PROVIDER` | `smtp` |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `orders@urbanlane.uk` (from step 4) |
| `SMTP_PASSWORD` | the mailbox password |
| `EMAIL_FROM` | `Urban Lane <orders@urbanlane.uk>` (must be the same mailbox) |
| `STORE_NOTIFICATIONS_EMAIL` | where order and contact notifications go, e.g. `orders@urbanlane.uk` |
| `IMAGE_STORAGE` | `local` |
| `UPLOAD_DIR` | `/home/u123456789/urban-lane-uploads` (from step 5) |
| `BASE_CURRENCY` | `PKR` |

Optional: `AUTH_SESSION_MAX_AGE_DAYS` (default 30). Leave the Stripe/PayPal/Safepay/PayFast
variables out; those payment methods aren't built yet (see section 11).

> **Special characters in the database password** (`@ : / # ?`) must be URL-encoded inside
> `DATABASE_URL`, e.g. `@` → `%40`. Easiest is a password with letters and numbers only.

Click **Deploy**. The first deploy installs packages and builds (several minutes because of the images).

---

## 7. Domain and SSL

1. hPanel → **Domains**: make sure your domain points to this hosting. If you bought it at
   Hostinger it's automatic. Otherwise set the nameservers Hostinger shows, or an A record to
   your hosting IP. Note: **urbanlane.uk currently shows Hostinger's "parked domain" page**, so
   connect it to the Node.js app (hPanel → the app → *Domain*).
2. hPanel → **Security → SSL**: install the free SSL certificate for the domain (often automatic)
   and turn on **Force HTTPS**.
3. Wait for DNS/SSL (minutes to a few hours), then open `https://urbanlane.uk`.

---

## 8. First login and securing the admin account

1. Go to `https://urbanlane.uk/login` and log in with `admin@urbanelane.com` and the new admin
   password. You should land on the store; open `/admin`.
2. The admin email `admin@urbanelane.com` isn't a real mailbox, so "Forgot password" can't reach
   you. Change it to your real email in **phpMyAdmin → SQL**:
   ```sql
   UPDATE `User` SET `email` = 'you@yourdomain.com' WHERE `role` = 'ADMIN';
   ```
3. Log out, then use **Forgot password** on the login page with your real email to set a password
   only you know. (There's no "change password" page; the reset email is the way.)
4. **Admin → Settings**: check the support phone, rotating strip messages, Cash on Delivery limit,
   bank-transfer instructions (still the placeholder "Bank XYZ, Account 0000-0000-0000",
   **replace it with your real bank details**), shipping fee and free-shipping threshold.

---

## 9. Launch checklist (on the live site)

- [ ] Home page shows the banners, category tiles, Shop by brand, Featured rows.
- [ ] Men / Women / Kids pages show their banners and tiles; a sub-category (e.g. Women → Dresses) lists products.
- [ ] Filters and sorting work; search finds products.
- [ ] Product page: pick size/colour → **Add to bag** → bag → checkout with **Cash on Delivery** → confirmation page and an order email.
- [ ] Register with a real address → verification email arrives → verify → log in → wishlist works.
- [ ] Admin → upload a product image → it shows on the product page (proves `UPLOAD_DIR` works).
- [ ] `https://urbanlane.uk/sitemap.xml` lists `https://urbanlane.uk/...` addresses.
- [ ] Padlock (HTTPS) shows in the browser; `http://` redirects to `https://`.
- [ ] Delete the test order from Admin → Orders if you placed one.

---

## 10. Updating the site later

**Code or design changes** (anything Claude edits in this folder):
1. Commit and push to GitHub (`git add -A && git commit -m "…" && git push`).
2. hPanel → the Node.js app → **Redeploy** (or enable auto-deploy on push, if offered).
   The build command applies database changes automatically.

**Products, stock, prices, orders, categories, featured/outlet flags, strip messages:** use
**Admin**. These live in the database and need no redeploy.

**New catalogue batches imported on this PC** (the import scripts): the live database is now the
real one, so don't re-import `db-bundle.sql` over it (that would erase live orders and customers).
Ask Claude to produce an import file for only the new products and run it against the live
database, or add them in Admin.

**Banners, category tiles, Shop-by-brand/age/gender cards** are set in code
(`src/components/collection/*Landing.tsx`, `prisma/seed.ts`, the `Banner` table) and change through a
redeploy. (An admin screen for these hasn't been built yet.)

### Backups
- hPanel → **Files → Backups** takes daily backups on most plans. Also download a database copy
  before big changes: phpMyAdmin → **Export** → *Quick* → SQL.
- Back up the `urban-lane-uploads` folder occasionally (File Manager → compress → download).

---

## 11. Known limitations (decide before or after launch)

| Item | Status |
|---|---|
| **Card and PayPal payments** | Not built. Only **Cash on Delivery** and **Bank Transfer** work, and checkout only offers those. The footer says *"We accept PayPal, Cards, Bank Transfer and Cash on Delivery"*, so **edit that text before launch** to avoid promising payment methods that don't exist. |
| **Outlet** page | Empty until products are ticked "Outlet / on sale" in Admin. The "30% OFF" banner links there. |
| **Jewellery** tab | No products yet; the tab shows an empty page. |
| Demo coupon `WELCOME10` | Still in the database from the original setup. Delete or keep it in phpMyAdmin (`Coupon` table). |
| Email addresses `@urbanelane.com` | Placeholders used in older settings; the steps above replace them with your real domain. |
| Banners / brand cards / category tiles | Code-managed (no admin screen yet). |
| Remaining low-risk advisories | `postcss` (bundled in Next.js, only used to compile your own CSS during build; fix needs Next.js 16) and `nodemailer` (only exploitable with attacker-controlled message options; the site only sends its own templates). |

---

## 12. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Build fails with "out of memory" | Shared plans limit memory. Redeploy once more (the second build is lighter); if it keeps failing, upgrade to a Cloud plan. |
| Site shows **500 / Application error** | Wrong `DATABASE_URL` (check user, password, host, name and URL-encoding), or the database wasn't imported. Check the app **Logs** in hPanel. |
| Pages work but **login keeps returning to the login page** | `AUTH_SECRET` missing, or `AUTH_URL`/`APP_URL` not your exact `https://` domain, or `AUTH_TRUST_HOST` not `true`. |
| Registration works but **no verification email** | SMTP values wrong; `EMAIL_FROM` must be the same mailbox as `SMTP_USER`; check the mailbox isn't over quota. |
| **Uploaded images don't show** | `UPLOAD_DIR` missing or not an absolute path; the folder must exist. |
| Sitemap / emails contain `localhost` | `APP_URL` not set to your domain. Set it and redeploy. |
| `P1001: Can't reach database server` during build | Remove `npx prisma migrate deploy &&` from the build command, deploy, then run `npx prisma migrate deploy` from hPanel's terminal/SSH when you have database changes. |

---

## Reference: files involved

- `db-bundle.sql`: production database (git-ignored; keep it safe).
- `prisma/prepare-production-db.ts`: rebuilds a clean copy for a fresh database (removes demo customer and test orders, sets the admin password). Only ever run it against a **copy**.
- `src/lib/site.ts`: domain normalisation. `src/app/uploads/[...path]/route.ts`: serves `UPLOAD_DIR`.
- `.env.example`: every setting with notes.
