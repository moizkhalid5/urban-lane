> **Superseded:** use [HOSTINGER_SHARED_DEPLOYMENT.md](HOSTINGER_SHARED_DEPLOYMENT.md) (Oct 2026). This older guide refers to `code-bundle.zip`/`uploads-bundle.zip` and the June database.

# Deploying Urban Lane to Hostinger — Simple Guide

You have **3 files** in your project folder to upload. That's it:

| File | What it is |
|---|---|
| `code-bundle.zip` | The website code (~230 KB) |
| `db-bundle.sql` | Your database with all 175 products + admin (~270 KB) |
| `uploads-bundle.zip` | All product images (~250 MB) |

> If you ever change products/images locally and want fresh files:
> `npm run images:bundle` (images) and re-export the DB (see step 2c).

> **Note:** the code goes to Hostinger **via GitHub** (below). The database
> (`db-bundle.sql`) and images (`uploads-bundle.zip`) do **not** go through
> GitHub — you upload them once directly (Steps 1 and 6).

---

## STEP 0 — Push the code to GitHub (one time)

The repository is already initialized and committed locally. You just need to
create an empty repo on GitHub and push.

1. Go to **github.com** → top-right **+** → **New repository**.
2. Name it `urbane-lane`. Choose **Private** (recommended — it's your business code).
   **Do NOT** tick "Add a README / .gitignore / license" (the repo must start empty).
3. Click **Create repository**, then copy the URL it shows (e.g. `https://github.com/YOURNAME/urbane-lane.git`).
4. In a terminal **in your project folder** (`d:\Urban Lane`), run:
   ```bash
   git remote add origin https://github.com/YOURNAME/urbane-lane.git
   git push -u origin main
   ```
   The first push will ask you to sign in to GitHub (a browser window or a token). After that, your code is on GitHub.

> Later, whenever you change code: `git add -A && git commit -m "what changed" && git push`.

---

## Deploying from GitHub on Hostinger

After Step 0, connect Hostinger to the GitHub repo:

1. hPanel → **Advanced** → **GIT**.
2. **Create a new repository deployment:**
   - **Repository:** your GitHub URL.
   - **Branch:** `main`.
   - **Directory:** your Node.js app folder.
   - If the repo is **Private**, hPanel shows an **SSH key** — copy it, then in GitHub go to your repo → **Settings → Deploy keys → Add deploy key**, paste it, save. (Or make the repo public, but private is safer.)
3. Click **Deploy** — Hostinger pulls your code into the app folder.
4. Then continue with **Steps 4–8 below** (env vars → install/build → images → domain).
5. **Future updates:** `git push` from your PC, then in hPanel **GIT → Deploy** (pull), then rebuild + restart the Node app.

> The rest of the steps (database import, env vars, build, images, domain) are the same whether you deploy by GitHub or by zip. Continue below.

---

## Hostinger build settings (use these exact values)

When Hostinger asks for / auto-detects the app settings, use:

| Setting | Value |
|---|---|
| Framework | **Next.js** (it should auto-detect; if it shows "Other", pick Next.js or set the fields below) |
| **Node.js version** | **22** (matches `.nvmrc` / `package.json` engines) |
| **Build command** | `npm run build` |
| **Run / Start command** | `npm start` |
| **Output directory** | `.next` |
| **App / port** | `3000` (the app listens on port 3000 by default) |
| **Root directory** | the repo root (where `package.json` is) |

> If you ever saw **"unsupported framework" / "invalid project structure"**, it's fixed now:
> the project uses a plain `next.config.mjs`, `package.json` is at the repo root, Node is
> pinned to **22**, and `node_modules` is never committed. Re-pull/redeploy after pushing.

---

## STEP 1 — Create the database (hPanel)

1. Log in to **hPanel** → **Databases** → **Management** (MySQL Databases).
2. Create a new database. Write down these 4 things:
   - **Database name** (e.g. `u123_urbane`)
   - **Username** (e.g. `u123_urbane`)
   - **Password** (the one you set)
   - **Host** (usually `localhost`)
3. Click **Enter phpMyAdmin** for that database.
4. In phpMyAdmin: click the **Import** tab → **Choose File** → select `db-bundle.sql` → **Import**.
   - ✅ This loads all tables, your 175 products, categories, brands, and the admin login.

---

## STEP 2 — Create the Node.js app (hPanel)

1. In hPanel → **Advanced** → **Node.js** (or **Website → Node.js app**).
2. Create application:
   - **Node version:** 20 or higher
   - **Application root:** e.g. `urbane` (a folder it creates)
   - **Application startup file:** `node_modules/.bin/next` is not needed — set **start command** to `npm start` (see step 5).
3. Note the **Application root path** shown (e.g. `/home/u123/urbane`). You'll upload code there.

---

## STEP 3 — Upload the code

1. hPanel → **Files** → **File Manager**.
2. Open your **Application root** folder (from step 2).
3. Upload `code-bundle.zip` into it → right-click → **Extract**.
   - You should now see `src`, `prisma`, `package.json`, etc. in that folder.
4. Delete the `code-bundle.zip` from the server after extracting (optional, keeps it tidy).

---

## STEP 4 — Set environment variables

In the **Node.js app** settings (hPanel) there is an **Environment variables** section. Add these:

| Name | Value |
|---|---|
| `DATABASE_URL` | `mysql://USERNAME:PASSWORD@localhost:3306/DATABASENAME` (use your step‑1 details) |
| `AUTH_SECRET` | a long random string — generate locally with `npx auth secret` and paste it |
| `APP_URL` | `https://yourdomain.com` |
| `NEXTAUTH_URL` | `https://yourdomain.com` |
| `IMAGE_STORAGE` | `local` |
| `NODE_ENV` | `production` |

(Email/payment keys can be added later when you enable them.)

---

## STEP 5 — Install, build, and start

In the Node.js app panel there are buttons / a terminal. Run these **in order**:

1. **Run NPM Install** (button) — or in terminal: `npm install`
2. **Apply the database schema** (terminal): `npx prisma generate`
   - The data is already imported (step 1), so you do **not** run migrate or seed.
3. **Build** (terminal): `npm run build`
4. **Set the start command** to: `npm start`
5. **Start / Restart** the application.

---

## STEP 6 — Upload the product images

1. File Manager → open `public/uploads` inside your app folder.
2. Upload `uploads-bundle.zip` there → right-click → **Extract**.
   - You should now see a `products` folder with image folders inside.
3. Test in your browser: `https://yourdomain.com/uploads/products/707-731/1.png` should show an image.

---

## STEP 7 — Point your domain + enable SSL

1. hPanel → attach your domain to this Node.js app (or set it as the app's domain).
2. hPanel → **SSL** → enable the free SSL certificate for your domain (so it's `https`).

---

## STEP 8 — Final checks

1. Visit `https://yourdomain.com` — products and images should show.
2. Go to `https://yourdomain.com/admin` and log in:
   - **Email:** `admin@urbanelane.com`
   - **Password:** `ChangeMe123!`
3. **⚠️ Immediately change the admin password** (and ideally create your own admin account).

---

## If something doesn't work

- **Site won't start / 503:** check the Node.js app **logs** in hPanel. Usually a missing env var (`DATABASE_URL` or `AUTH_SECRET`).
- **"Can't reach database":** double‑check `DATABASE_URL` username/password/db name match step 1 exactly.
- **Images missing:** make sure `uploads-bundle.zip` was extracted **inside** `public/uploads` (not the app root).
- **Login fails:** confirm `AUTH_SECRET` is set and `NEXTAUTH_URL` matches your real domain (https).

---

### (2c) Re-exporting the database later
If you add products locally and want to refresh the live DB, export locally with:
```
docker exec urbane_lane_db mysqldump -uurbane -purbane --no-tablespaces urbane_lane > db-bundle.sql
```
then re-import `db-bundle.sql` in phpMyAdmin (drop old tables first, or use a fresh DB).
