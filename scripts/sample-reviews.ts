/**
 * LOCAL DESIGN PREVIEW ONLY. Adds labelled sample reviews (isSample = true) and sample "sold" numbers to
 * the LOCAL test database, so the review designs can be seen before real reviews exist. Samples are
 * only displayed when SHOW_SAMPLE_REVIEWS=true, and every one carries a "Sample review" label.
 * Refuses to run against any database that isn't on this computer.
 *
 *   npx tsx scripts/sample-reviews.ts add      # add samples
 *   npx tsx scripts/sample-reviews.ts remove   # remove samples and restore the sold numbers
 */
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { prisma } from "@/lib/prisma";
import { ensureReviewTables } from "@/lib/reviews/db";

const BACKUP = path.join(os.tmpdir(), "urban-lane-sample-sales-backup.json");

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^:/]+)/)?.[1] ?? "";
  if (!["localhost", "127.0.0.1"].includes(host)) {
    console.error(`Refusing to run: DATABASE_URL points at "${host || "unknown"}", not this computer.`);
    process.exit(1);
  }
}

type Sample = { name: string; city: string; rating: number; title?: string; body: string; daysAgo: number };

// Grouped by product so the product pages show a spread of ratings.
const SAMPLES: Record<"jacket" | "dress" | "kids" | "chinos" | "store", Sample[]> = {
  jacket: [
    { name: "Saad", city: "Islamabad", rating: 5, body: "Jacket ki stitching aur finishing kamaal ki hai. Sardiyon ke liye perfect.", daysAgo: 6 },
    { name: "Usman", city: "Rawalpindi", rating: 5, title: "Genuine UK brand", body: "Great price for a genuine UK brand. Warm, light and fits perfectly. Will definitely order again.", daysAgo: 12 },
    { name: "Hira", city: "Lahore", rating: 4, body: "Size thora bara tha lekin exchange foran ho gaya. Customer service zabardast hai.", daysAgo: 20 },
    { name: "Ali", city: "Quetta", rating: 4, body: "Good quality, though delivery took a day longer than expected.", daysAgo: 31 },
    { name: "Hamza", city: "Lahore", rating: 5, body: "Fast delivery and the jacket was well packed. Very happy with my purchase.", daysAgo: 44 },
  ],
  dress: [
    { name: "Iqra", city: "Lahore", rating: 5, title: "So many compliments", body: "Lovely dress, I got so many compliments at the family dinner.", daysAgo: 4 },
    { name: "Zainab", city: "Multan", rating: 4, body: "Colour is slightly darker than the photos but still looks lovely.", daysAgo: 17 },
    { name: "Maryam", city: "Sialkot", rating: 5, body: "Exactly what I was looking for, fits true to size.", daysAgo: 28 },
  ],
  kids: [
    { name: "Farah", city: "Peshawar", rating: 5, body: "Mere bete ke liye liya tha, kapra soft hai aur dhulai ke baad bhi waisa hi hai.", daysAgo: 9 },
    { name: "Imran", city: "Hyderabad", rating: 4, body: "Price thori zyada lagi lekin quality dekh kar paisa wasool.", daysAgo: 25 },
  ],
  chinos: [
    { name: "Bilal", city: "Karachi", rating: 5, body: "Original brand, bilkul waisa jaisa tasveer mein tha. Packing bhi bohat achi thi.", daysAgo: 3 },
    { name: "Ayesha", city: "Lahore", rating: 5, body: "Fabric quality is excellent and the fit is exactly as described. Delivery took 3 days.", daysAgo: 15 },
  ],
  store: [
    { name: "Mahnoor", city: "Karachi", rating: 5, title: "Great first order", body: "Pehli dafa online kapre liye aur experience bohat acha raha. Shukriya Urban Lane!", daysAgo: 7 },
    { name: "Sana", city: "Faisalabad", rating: 5, title: "Easy cash on delivery", body: "Cash on delivery ki sahoolat se bohat asani hui. Quality A1 hai.", daysAgo: 22 },
  ],
};
const SAMPLE_SOLD = { jacket: 37, dress: 24, kids: 15, chinos: 12 };

async function pick(categorySlugs: string[], titleHint?: string) {
  return prisma.product.findFirst({
    where: {
      status: "ACTIVE",
      images: { some: {} },
      categories: { some: { category: { slug: { in: categorySlugs } } } },
      ...(titleHint ? { title: { contains: titleHint } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, salesCount: true },
  });
}

async function add() {
  await ensureReviewTables();
  if ((await prisma.review.count({ where: { isSample: true } })) > 0) {
    console.log("Samples already added. Run 'remove' first to start again.");
    return;
  }
  const products = {
    jacket: (await pick(["men-coats-and-jackets"], "Jacket")) ?? (await pick(["men-coats-and-jackets"])),
    dress: await pick(["women-dresses"]),
    kids: await pick(["kids-baby-boys-0-24m-tops", "kids-boys-2-8-yrs-tops"]),
    chinos: (await pick(["men-trousers-chinos"], "Chino")) ?? (await pick(["men-trousers-chinos"])),
  };
  const backup: Record<string, number> = {};
  let position = 0;
  for (const [key, list] of Object.entries(SAMPLES) as [keyof typeof SAMPLES, Sample[]][]) {
    const product = key === "store" ? null : products[key];
    if (key !== "store" && !product) {
      console.log(`No ${key} product found; skipping its samples.`);
      continue;
    }
    for (const s of list) {
      position += 1;
      await prisma.review.create({
        data: {
          productId: product?.id ?? null,
          authorName: s.name,
          authorCity: s.city,
          rating: s.rating,
          title: s.title ?? null,
          body: s.body,
          source: "OTHER",
          status: "APPROVED",
          verifiedPurchase: key !== "store",
          featured: true,
          featuredPosition: position,
          isSample: true,
          reviewedAt: new Date(Date.now() - s.daysAgo * 86_400_000),
        },
      });
    }
    if (product && key !== "store") {
      backup[product.id] = product.salesCount;
      await prisma.product.update({ where: { id: product.id }, data: { salesCount: SAMPLE_SOLD[key] } });
      console.log(`${key}: ${product.title} (${list.length} sample reviews, ${SAMPLE_SOLD[key]} sample sold)`);
    }
  }
  await fs.writeFile(BACKUP, JSON.stringify(backup));
  console.log(`Added ${position} sample reviews (all labelled). Set SHOW_SAMPLE_REVIEWS=true to display them.`);
}

async function remove() {
  await ensureReviewTables();
  const { count } = await prisma.review.deleteMany({ where: { isSample: true } });
  let restored = 0;
  try {
    const backup = JSON.parse(await fs.readFile(BACKUP, "utf8")) as Record<string, number>;
    for (const [id, salesCount] of Object.entries(backup)) {
      await prisma.product.updateMany({ where: { id }, data: { salesCount } });
      restored += 1;
    }
    await fs.rm(BACKUP, { force: true });
  } catch {}
  console.log(`Removed ${count} sample reviews; restored the sold number of ${restored} products.`);
}

assertLocalDatabase();
(process.argv[2] === "remove" ? remove() : process.argv[2] === "add" ? add() : Promise.reject(new Error("Use 'add' or 'remove'.")))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
