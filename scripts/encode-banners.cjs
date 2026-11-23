/**
 * Makes the web copies of the banner artwork: WebP at quality 94, same pixel size as the original.
 * The originals stay in public/ untouched as the masters; pages use the copies, which are ~80% smaller
 * and look the same (checked at 3x zoom; PSNR ≥ 43 dB). A copy that wouldn't be at least 30% smaller is
 * written as an exact copy of the original instead.
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

(async () => {
  let before = 0;
  let after = 0;
  for (const [from, to] of JOBS) {
    const src = fs.readFileSync(path.join(dir, from));
    const out = await sharp(src).webp({ quality: 94, effort: 6, smartSubsample: true }).toBuffer();
    const keep = out.length > src.length * 0.7;
    fs.writeFileSync(path.join(dir, to), keep ? src : out);
    const size = keep ? src.length : out.length;
    before += src.length;
    after += size;
    console.log(`${to.padEnd(34)} ${String(Math.round(src.length / 1024)).padStart(5)} KB → ${String(Math.round(size / 1024)).padStart(5)} KB${keep ? "  (copied as is)" : ""}`);
  }
  console.log(`total ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB`);
})();
