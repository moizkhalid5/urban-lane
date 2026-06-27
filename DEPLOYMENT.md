# Deploying Urban Lane to Hostinger (Node.js Web Apps hosting)

This guide targets **Hostinger's Node.js Web Apps hosting** (hPanel → **Websites
→ Add Website → Node.js Apps**), deploying straight from **GitHub**. It uses
Hostinger's **MySQL** database and keeps all product images as **local object
storage inside the website directory** (`public/uploads`) — no external S3 or
Cloudinary required.

> **Plan requirement:** Node.js Web Apps hosting is available on Hostinger
> **Business** web hosting and above (and on Cloud/VPS). It is **not** available
> on the entry-level *Single* plan. If you don't see **Node.js Apps** under *Add
> Website*, upgrade the plan or use a VPS.

The app is already configured for this:

| What Hostinger asks | Value to use |
|---|---|
| Framework | **Next.js** (auto-detected) |
| **Node.js version** | **22** (matches `.nvmrc` and `package.json` engines) |
| **Install command** | `npm ci` |
| **Build command** | `npm run build` |
| **Start command** | `npm run start -- -p $PORT` |
| **Output directory** | `.next` |
| Root directory | repo root (where `package.json` is) |

> **Why `-p $PORT`?** Hostinger assigns the app a port at runtime via the `$PORT`
> environment variable and proxies your domain to it. `next start` binds to that
> port, so **never** hardcode `3000` in production. (`next start` also reads a
> `PORT` env var automatically, so plain `npm start` works too — but use the
> command above to be explicit.)

---

## STEP 0 — Push the code to GitHub (one time)

The repo is already initialized and committed. Create an **empty** GitHub repo
(no README/.gitignore/license) named `urban-lane`, then:

```bash
git remote add origin https://github.com/YOURNAME/urban-lane.git
git push -u origin main
```

Later updates: `git add -A && git commit -m "…" && git push`.

> The **code** ships through GitHub. The **database data** and the **product
> images** do **not** go through GitHub — you load those once, directly on the
> server (Steps 4 and 6). Images are git-ignored on purpose (they're large).

---

## STEP 1 — Create the MySQL database (hPanel)

1. hPanel → **Databases → MySQL Databases**.
2. Create a database + user. Write down all four values:
   - **Database name** (e.g. `u123456_urban`)
   - **Username** (e.g. `u123456_urban`)
   - **Password**
   - **Host** (usually `localhost` when the DB and app share the account)
3. Build your connection string (you'll paste it as `DATABASE_URL` in Step 3):
   ```
   mysql://USERNAME:PASSWORD@HOST:3306/DATABASE_NAME
   ```
   URL-encode special characters in the password (`@`→`%40`, `#`→`%23`, etc.).

---

## STEP 2 — Create the Node.js app from GitHub (hPanel)

1. hPanel → **Websites → Add Website → Node.js Apps**.
2. Choose **Import Git Repository** → authorize GitHub → pick `urban-lane`,
   branch `main`.
   - If the repo is **private**, Hostinger shows an **SSH/deploy key** — add it
     in GitHub under the repo's **Settings → Deploy keys**.
3. Review the auto-detected settings and set them to the table above
   (Node **22**, install `npm ci`, build `npm run build`,
   start `npm run start -- -p $PORT`, output `.next`).
4. **Don't deploy yet** — add the environment variables first (Step 3).

---

## STEP 3 — Set environment variables (hPanel)

In the Node.js app's **Environment variables** section, add the following. See
[`.env.production.example`](.env.production.example) for the full annotated list.

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | your Step‑1 connection string |
| `AUTH_SECRET` | a long random string — generate locally with `npx auth secret` |
| `APP_URL` | `https://your-domain.com` |
| `NEXTAUTH_URL` | `https://your-domain.com` |
| `AUTH_URL` | `https://your-domain.com` |
| `IMAGE_STORAGE` | `local` |
| `BASE_CURRENCY` | `PKR` |
| `SEED_ADMIN_EMAIL` | `admin@your-domain.com` |
| `SEED_ADMIN_PASSWORD` | a strong password (used once by the seed) |
| `EMAIL_PROVIDER` | `console` (switch to `smtp`/`resend` later) |

Now click **Deploy**. Hostinger runs `npm ci` → `npm run build` and starts the
app with `npm run start -- -p $PORT`.

> `npm ci` runs `prisma generate` (via `postinstall`), and `npm run build` runs
> it again before `next build`. The build does **not** touch the database, so it
> succeeds even before the DB tables exist.

---

## STEP 4 — Create the database schema + data

Open the Node.js app's **terminal/console** in hPanel (or SSH) **in the app
root**, then choose ONE path:

**A. Fresh store with demo catalogue (simplest):**
```bash
npm run db:setup
```
This runs `prisma migrate deploy` (creates every table from the committed
migration) and then the seed (categories, brands, currencies, settings, an admin
user, and demo products).

**B. Fresh store with the real 175-product catalogue:**
```bash
npm run prisma:deploy   # create tables
npm run db:seed         # reference data + admin (clears demo products)
npm run db:import       # import the real catalogue from prisma/import-data.json
```

> If you prefer the old phpMyAdmin route, you can instead **Import** a SQL dump
> under hPanel → phpMyAdmin. But `npm run db:setup` is the recommended,
> repeatable way and needs no dump file.

After the schema/data step, **Restart** the app from hPanel.

---

## STEP 5 — Upload the product images (local object storage)

Images live **inside the website directory** at `public/uploads` and are served
at `/uploads/*`. They are git-ignored, so a `git push` + redeploy never deletes
them — you upload them once.

1. Bundle your local images into a zip:
   - macOS/Linux: `npm run images:bundle:unix` → creates `uploads-bundle.zip`
   - Windows: `npm run images:bundle`
2. hPanel → **File Manager** → open the app's `public/uploads` folder.
3. Upload `uploads-bundle.zip` there → right-click → **Extract**.
4. Verify in a browser, e.g.
   `https://your-domain.com/uploads/products/707-731/1.png` should show an image.

> Admin image uploads from the live dashboard also write here automatically.
> To keep uploads on a path that survives even a full re-clone, you can point
> `UPLOAD_DIR` at a persistent location that's surfaced at `/uploads/*`
> (e.g. a symlink into `public/uploads`); the default needs no configuration.

---

## STEP 6 — Domain + SSL

1. hPanel → attach your domain to this Node.js app.
2. hPanel → **SSL** → enable the free certificate so the site is `https`.
3. Confirm `APP_URL`, `NEXTAUTH_URL`, and `AUTH_URL` all match the final HTTPS
   domain, then **Restart** the app.

---

## STEP 7 — Final checks

1. Visit `https://your-domain.com` — products and images render.
2. Log in at `https://your-domain.com/admin` with `SEED_ADMIN_EMAIL` /
   `SEED_ADMIN_PASSWORD`.
3. **Immediately change the admin password** (and create your own admin user).

---

## Updating later

1. `git push` your changes.
2. hPanel → the Node.js app → **Deploy** (pulls, reinstalls, rebuilds, restarts).
3. If you changed `prisma/schema.prisma`, run `npm run prisma:deploy` in the app
   terminal after deploy. (Generate a migration locally first with
   `npm run prisma:migrate` and commit it.)

---

## Troubleshooting

- **App won't start / 502 / 503:** check the app **logs** in hPanel. Usually a
  missing env var (`DATABASE_URL`, `AUTH_SECRET`) or the start command not using
  `-p $PORT`.
- **"Can't reach database server":** re-check `DATABASE_URL` — username, password
  (URL-encoded), host (`localhost`), and DB name must match Step 1 exactly.
- **Tables don't exist / Prisma P2021:** you skipped Step 4 — run
  `npm run db:setup` (or `npm run prisma:deploy`) in the app terminal.
- **Login fails / redirect loop:** `AUTH_SECRET` must be set, and `NEXTAUTH_URL`
  / `AUTH_URL` must equal the real HTTPS domain. (`trustHost` is already enabled
  in code.)
- **Images 404:** confirm files were extracted **inside** `public/uploads`
  (not the app root) and `IMAGE_STORAGE=local`.
- **Build error `Cannot find module 'tailwindcss'` (or `typescript`/`prisma`):**
  the platform ran a production-only install (`NODE_ENV=production` makes npm skip
  `devDependencies`). This repo already keeps every build-time package
  (`tailwindcss`, `postcss`, `autoprefixer`, `typescript`, `prisma`, `tsx`, the
  `@types/*`) in `dependencies` so the build works either way. If you still hit
  it on a fork, set the **Install command** to `npm ci --include=dev`.
