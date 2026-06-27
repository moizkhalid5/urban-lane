# Urban Lane

A production-ready custom ecommerce store (fashion / lifestyle), built from scratch to replace a Shopify/WooCommerce setup. Clean, premium, mobile-first storefront plus a full custom admin panel.

> Inspired by the *structure* of clean ecommerce themes — **no** Shopify Dawn / Liquid / licensed theme code is used.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | MySQL / MariaDB |
| ORM | Prisma |
| Validation | Zod |
| Auth | Auth.js (NextAuth v5) — credentials + email verification |
| Email | Provider-agnostic (console / Resend / SMTP) |
| Images | Pluggable storage (local dev / Cloudinary / S3 / R2) |
| Payments | Gateway abstraction (COD + bank transfer live; Stripe/PayPal/Safepay/PayFast ready) |

## Prerequisites

- Node.js ≥ 20 (tested on 24)
- Docker Desktop (for the local MySQL container) — or a hosted MySQL/MariaDB URL
- npm

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   then edit AUTH_SECRET (npx auth secret) and admin credentials

# 3. Start MySQL (Docker)
npm run db:up

# 4. Create the schema + generate the client
npm run prisma:migrate      # name the migration e.g. "init"

# 5. Seed categories, brands, demo products, admin user, demo orders
npm run db:seed

# 6. Run the dev server
npm run dev
```

Visit http://localhost:3000 — admin at http://localhost:3000/admin.

### Default admin login

Set in `.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). Defaults:

- Email: `admin@urbanlane.com`
- Password: `ChangeMe123!`  ← change this before deploying.

## Useful scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (runs `prisma generate`) |
| `npm run db:up` / `db:down` | Start / stop the MySQL container |
| `npm run prisma:migrate` | Create & apply a dev migration |
| `npm run prisma:deploy` | Apply migrations in production |
| `npm run prisma:studio` | Browse the database in Prisma Studio |
| `npm run db:seed` | Seed reference + demo data |
| `npm run db:reset` | Drop, re-migrate, and re-seed |

## Project structure

```
src/
  app/            # App Router routes (storefront + admin + api)
  components/     # Shared UI components
  features/       # Feature modules (cart, catalog, checkout, account, admin)
  lib/            # prisma client, auth, money/currency, email, storage, payments, validation
prisma/
  schema.prisma   # Data models
  seed.ts         # Seed script
  data/           # Category tree + brand list source data
public/uploads/   # Local image storage (dev)
```

## Integrations — where to add real credentials

- **Email**: set `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`, or `EMAIL_PROVIDER=smtp` + SMTP vars. Until then `console` logs emails to the terminal. See `src/lib/email`.
- **Images**: set `IMAGE_STORAGE` and the matching keys. See `src/lib/storage`.
- **Payments**: COD and bank transfer work immediately and are toggled in Admin → Settings. Card gateways are stubs in `src/lib/payments` — drop keys into `.env` and complete the adapter.

## Deployment notes

- Any Node host that runs `next start` works (Render, Railway, Fly, a VPS, etc.).
- Set all `.env` values in the host. Run `npm run prisma:deploy` on release.
- Switch `IMAGE_STORAGE` off `local` for multi-instance hosting.

## Demo accounts (after seeding)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@urbanlane.com` | `ChangeMe123!` (from `.env`) |
| Customer | `customer@example.com` | `Customer123!` |

## Features

**Storefront**
- Sticky header with mega menu, search, account, cart, and a **multi-currency switcher** (PKR/USD/GBP/EUR with flags + whole-number rounding)
- Homepage: hero carousel, category tiles, featured products, **brand slider**, outlet strip, newsletter
- Collection pages: breadcrumbs, filters (brand, size, colour, price, availability, sale), sort, pagination, mobile filter drawer, empty state
- Product page: image gallery, variant selection (**single-option products skip forced selection**), stock states, accordion, related + recently-viewed, wishlist, Product + Breadcrumb **JSON-LD**
- Cart (guest cookie + user DB, stock-capped), checkout (server-authoritative totals/stock, coupon, **COD limit**, bank transfer), order confirmation
- Customer account: register with **email verification**, login, password reset, orders + order detail, address book, wishlist
- Content: about, contact (form → email), FAQ, returns (**refund request form** → email), shipping/privacy/terms policies
- SEO: dynamic metadata, canonical URLs, Open Graph, `sitemap.xml`, `robots.txt`, schema.org

**Admin** (`/admin`, role-gated)
- Dashboard (revenue, orders, pending, low stock, top products)
- Products (list, create/edit with variants + image upload + categories + SEO, archive, delete)
- Orders (list, detail, payment/fulfillment status, tracking, admin notes, printable invoice)
- Categories (nested tree CRUD), Inventory (inline stock), Customers, Settings (payment toggles, COD limit, shipping, announcement)

**Architecture & security**
- Payment gateway abstraction (COD + bank transfer live; Stripe/PayPal/Safepay/PayFast adapters)
- Pluggable image storage + provider-agnostic email
- Zod validation everywhere, bcrypt passwords, RBAC middleware + per-action guards, rate-limited sensitive endpoints, security headers, audit log

## Manual test checklist

1. `npm run db:up && npm run prisma:migrate && npm run db:seed && npm run dev`
2. Browse homepage → collection → product; switch currency; add to cart; checkout with COD → see confirmation.
3. Register a new account → check terminal for the verification email link → verify → log in.
4. Log in as admin → create/edit a product → view it on the storefront; update an order status.
5. Visit `/sitemap.xml` and `/robots.txt`.

## Deploying to Hostinger (Node.js app + MySQL)

This app runs on Hostinger's **Node.js app** hosting (hPanel) with a **MySQL** database.

1. **Create a MySQL database** in hPanel → Databases. Note the DB name, user, password and host.
2. **Set environment variables** for the Node.js app (hPanel → Node.js → Environment, or a `.env`):
   - `DATABASE_URL="mysql://DBUSER:DBPASS@DBHOST:3306/DBNAME"`
   - `AUTH_SECRET` (generate with `npx auth secret`), `APP_URL`/`NEXTAUTH_URL` = your domain (https)
   - email / image / payment keys as you enable them
3. **Apply the schema.** Shared-hosting MySQL users usually **cannot create databases**, so `prisma migrate dev` (which needs a *shadow database*) will fail there. Use one of:
   - `npx prisma migrate deploy` — applies the committed migration in `prisma/migrations/` (no shadow DB needed) ✅ recommended, or
   - `npx prisma db push` — syncs the schema directly without migration history.
4. **Seed / import** (run once): `npm run db:seed` then `npx tsx prisma/import-products.ts` (uploads the catalogue + images).
5. **Build & start:** `npm run build` then start the app with `npm start` (hPanel runs the start script).
6. **Images (local disk on Hostinger — the $0 setup):** `IMAGE_STORAGE="local"` stores files in `public/uploads` on the Hostinger disk. New images uploaded via the admin persist there automatically. To move the **existing catalogue images** to the server once:
   - Run `npm run images:bundle` locally → produces `uploads-bundle.zip` (~250 MB).
   - In hPanel **File Manager**, upload the zip into your app's `public/uploads/` folder and **Extract** it there (it recreates `public/uploads/products/...`).
   - Verify a product image loads, e.g. `https://yourdomain/uploads/products/<SKU>/1.png`.
   - **Persistence:** confirm your Hostinger Node plan keeps the `public/uploads` folder across restarts/redeploys (most do). If a redeploy ever wipes it, just re-upload the bundle.
   - **Backup:** periodically download `public/uploads` (and export the MySQL DB) — they are your only copy of product media/data.
   - You can switch to Cloudflare R2 / Cloudinary later with no call-site changes (adapter in `src/lib/storage`).

> Note: the catalogue import (`scripts/build_import.py` → `prisma/import-products.ts`) reads the Excel master sheet and matches images by **Product SKU**. Re-running rebuilds the product table from `prisma/import-data.json`.

## Status

All milestones implemented and verified on **MySQL**: `tsc` clean, `next build` green, and routes smoke-tested end-to-end against the database (storefront, search, cart, checkout/order creation, auth + RBAC, admin CRUD, 175-product catalogue with images, SEO).
