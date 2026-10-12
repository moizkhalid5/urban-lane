/**
 * Pre-generates the resized product images (AVIF and WebP) that pages request, so the first
 * shopper to open a collection doesn't wait while each photo is converted. Next.js keeps the
 * results in .next/cache/images (for a year, see next.config.mjs).
 *
 * Run after each deploy or rebuild, against the running site:
 *   npx tsx scripts/warm-image-cache.ts                       # http://localhost:3000
 *   npx tsx scripts/warm-image-cache.ts https://urbanlane.uk  # the live site, from any PC
 *   npx tsx scripts/warm-image-cache.ts <url> --cards-only    # just listing-page sizes (faster)
 *
 * Reads the product photo files from public/uploads/products, which ship with the code.
 */
import { readdirSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/+$/, "");
const CARDS_ONLY = args.includes("--cards-only");
const CONCURRENCY = 4;

// Widths Next.js picks for our `sizes` attributes on common screens:
// product cards (25vw desktop, 33vw tablet, 50vw phone) and the product-page gallery (50vw / 100vw).
const CARD_WIDTHS = [384, 640, 750];
const GALLERY_WIDTHS = [750, 828, 1080, 1200];
const FORMATS = ["image/avif", "image/webp"];
const QUALITY = 75;

type Job = { path: string; width: number; accept: string };
const jobs: Job[] = [];
const root = join(process.cwd(), "public", "uploads", "products");
for (const dir of readdirSync(root, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const files = readdirSync(join(root, dir.name)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
  files.forEach((file, i) => {
    const path = `/uploads/products/${dir.name}/${file}`;
    const widths = new Set<number>(i < 2 ? CARD_WIDTHS : []); // cards show the first two photos
    if (!CARDS_ONLY) GALLERY_WIDTHS.forEach((w) => widths.add(w));
    for (const width of widths) for (const accept of FORMATS) jobs.push({ path, width, accept });
  });
}

let done = 0, failed = 0, generated = 0;
const started = Date.now();
async function worker() {
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    const url = `${BASE}/_next/image?url=${encodeURIComponent(job.path)}&w=${job.width}&q=${QUALITY}`;
    try {
      const res = await fetch(url, { headers: { Accept: `${job.accept},image/*` } });
      await res.arrayBuffer();
      if (!res.ok) failed++;
      else if (res.headers.get("x-nextjs-cache") !== "HIT") generated++;
    } catch {
      failed++;
    }
    if (++done % 250 === 0) console.log(`  ${done} done (${generated} newly generated, ${failed} failed)`);
  }
}

const total = jobs.length;
console.log(`Warming ${total} image variants on ${BASE}${CARDS_ONLY ? " (cards only)" : ""}…`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s: ${total} variants, ${generated} newly generated, ${failed} failed.`);
