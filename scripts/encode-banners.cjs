/**
 * Makes the web copies of the banner artwork from the originals (which stay in public/ untouched as the masters):
 *
 * - WebP at quality 94, same pixel size. ~80% smaller and look the same (checked at 3x zoom; PSNR ≥ 41 dB).
 *   A copy that wouldn't be at least 30% smaller is written as an exact copy of the original instead.
 * - For the tall phone pictures, also AVIF at quality 80 (4:4:4 colour), same pixel size: about half the
 *   WebP again, for the phones that can show it (nearly all); the others get the WebP. Plus a 780px-wide
 *   AVIF, which phones with a screen about that wide pick instead (srcset), at their screen's sharpness.
 * - A tiny blurred preview of each (src/lib/banner-placeholders.json), shown in the banner's place while
 *   the picture downloads on a slow connection.
 *
 *   node scripts/encode-banners.cjs
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const dir = path.join(__dirname, "..", "public", "images", "banners");
const HOME = ["urban-lane", "men-winter", "women", "kids-summer", "sale-season"];
const homeWidths = { "urban-lane": 1916, "men-winter": 1897, women: 1862, "kids-summer": 2406, "sale-season": 1960 };

/** [original, web copy] relative to public/images/banners */
const JOBS = [
  ...HOME.map((k) => [`home/${k}-phone-v1.webp`, `home/${k}-phone-v2.webp`]),
  ...HOME.map((k) => [`home/${k}-${homeWidths[k]}.webp`, `home/${k}-${homeWidths[k]}-v2.webp`]),
  ["outlet-desktop-v1.webp", "outlet-desktop-v2.webp"],
  ["outlet-phone-v1.webp", "outlet-phone-v2.webp"],
  ["men-edit-full.webp", "men-edit-full-v2.webp"],
  ["men-phone-v2.webp", "men-phone-v3.webp"],
  ["women-edit-full.webp", "women-edit-full-v2.webp"],
  ["women-phone-v1.webp", "women-phone-v2.webp"],
  ["kids-edit-wide.webp", "kids-edit-wide-v2.webp"],
  ["kids-phone-v1.webp", "kids-phone-v2.webp"],
  ["beauty-desktop-v1.webp", "beauty-desktop-v2.webp"],
  ["beauty-phone-v1.webp", "beauty-phone-v2.webp"],
];

const kb = (n) => String(Math.round(n / 1024)).padStart(5);

(async () => {
  const placeholders = {};
  for (const [from, to] of JOBS) {
    const src = fs.readFileSync(path.join(dir, from));
    const out = await sharp(src).webp({ quality: 94, effort: 6, smartSubsample: true }).toBuffer();
    const keep = out.length > src.length * 0.7;
    fs.writeFileSync(path.join(dir, to), keep ? src : out);
    let line = `${to.padEnd(34)} ${kb(src.length)} KB → webp ${kb(keep ? src.length : out.length)} KB${keep ? " (copied as is)" : ""}`;
    if (to.includes("phone")) {
      const avif = await sharp(src).avif({ quality: 80, effort: 6, chromaSubsampling: "4:4:4" }).toBuffer();
      fs.writeFileSync(path.join(dir, to.replace(/\.webp$/, ".avif")), avif);
      // and 780px wide, for phones whose screen is about that many pixels across (they'd get no sharper
      // picture from the full width); bigger screens still get the full width
      const small = await sharp(src).resize({ width: 780, kernel: "lanczos3" }).avif({ quality: 80, effort: 6, chromaSubsampling: "4:4:4" }).toBuffer();
      fs.writeFileSync(path.join(dir, to.replace(/\.webp$/, "-780.avif")), small);
      line += `, avif ${kb(avif.length)} KB (780px: ${kb(small.length)} KB)`;
    }
    const tiny = await sharp(src).resize({ width: 24 }).webp({ quality: 60 }).toBuffer();
    placeholders[`/img/banners/${to}`] = `data:image/webp;base64,${tiny.toString("base64")}`;
    console.log(line);
  }
  const json = path.join(__dirname, "..", "src", "lib", "banner-placeholders.json");
  fs.writeFileSync(json, JSON.stringify(placeholders, null, 1) + "\n");
  console.log(`placeholders: ${Object.keys(placeholders).length} → ${path.relative(process.cwd(), json)}`);
})();
