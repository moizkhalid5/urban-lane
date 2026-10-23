import { prisma } from "@/lib/prisma";
import { discountPercent } from "@/lib/money";

/**
 * "UK price" comparison: a product's real UK retail price (entered in Admin → Products, in pounds) shown
 * in rupees next to our price, with the saving, e.g. "Rs 12,400 · UK price ~~Rs 17,300~~ · -28%". Only shown
 * when our price is lower. It is a comparison with the UK shops' price, not a former price of ours, so it is
 * always labelled "UK price". Real sales use the product's compare-at price instead (components/ui/Price).
 *
 * Tables are created on first use (same SQL as prisma/migrations/20261023120000_uk_prices), because the
 * host's deploy doesn't run migrations.
 */
const CREATE_UK_PRICE = `CREATE TABLE IF NOT EXISTS \`UkPrice\` (
    \`productId\` VARCHAR(191) NOT NULL,
    \`pence\` INTEGER NOT NULL,
    \`source\` VARCHAR(500) NULL,
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`productId\`),
    CONSTRAINT \`UkPrice_productId_fkey\` FOREIGN KEY (\`productId\`) REFERENCES \`Product\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

const CREATE_SETTINGS = `CREATE TABLE IF NOT EXISTS \`PricingSettings\` (
    \`id\` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    \`gbpToPkr\` DOUBLE NOT NULL DEFAULT 360,
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

let ready: Promise<void> | null = null;
export function ensurePricingTables(): Promise<void> {
  ready ??= (async () => {
    await prisma.$executeRawUnsafe(CREATE_UK_PRICE);
    await prisma.$executeRawUnsafe(CREATE_SETTINGS);
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

export const DEFAULT_GBP_TO_PKR = 360;

export async function getGbpToPkr(): Promise<number> {
  try {
    await ensurePricingTables();
    const row = await prisma.pricingSettings.findUnique({ where: { id: "singleton" } });
    return row?.gbpToPkr && row.gbpToPkr > 0 ? row.gbpToPkr : DEFAULT_GBP_TO_PKR;
  } catch {
    return DEFAULT_GBP_TO_PKR;
  }
}

export type UkComparison = {
  /** UK price in rupees (base-currency minor units), rounded to the nearest Rs 100 */
  cents: number;
  /** how much cheaper our price is, rounded down (never overstated) */
  savePct: number;
};

/** UK price in rupees, rounded to the nearest Rs 100 (e.g. £48 × 360 = 17,280 → 17,300). */
export function ukPriceInRupees(pence: number, gbpToPkr: number): number {
  return Math.round(((pence / 100) * gbpToPkr) / 100) * 100;
}

/** The comparison to show, or null when there's no UK price or ours isn't at least 1% lower. */
export function compareWithUk(ourCents: number, pence: number | null | undefined, gbpToPkr: number): UkComparison | null {
  if (!pence || pence <= 0) return null;
  const ukCents = ukPriceInRupees(pence, gbpToPkr) * 100;
  if (ukCents <= ourCents) return null;
  const savePct = Math.floor(((ukCents - ourCents) / ukCents) * 100);
  return savePct >= 1 ? { cents: ukCents, savePct } : null;
}

/** UK comparisons for several products at once. */
export async function ukComparisonsFor(products: { id: string; priceCents: number }[]): Promise<Map<string, UkComparison>> {
  const out = new Map<string, UkComparison>();
  if (products.length === 0) return out;
  try {
    await ensurePricingTables();
    const [rate, rows] = await Promise.all([
      getGbpToPkr(),
      prisma.ukPrice.findMany({ where: { productId: { in: products.map((p) => p.id) } }, select: { productId: true, pence: true } }),
    ]);
    const pence = new Map(rows.map((r) => [r.productId, r.pence]));
    for (const p of products) {
      const c = compareWithUk(p.priceCents, pence.get(p.id), rate);
      if (c) out.set(p.id, c);
    }
  } catch (err) {
    console.error("[pricing] Couldn't load UK prices.", err);
  }
  return out;
}

/**
 * Products whose card shows a discount between min% and max%: a real sale (compare-at price) or, without
 * one, a saving against the UK price. Worked out exactly as components/ui/Price shows it. Used by ?save=.
 */
export async function productIdsWithDiscount(min: number, max: number): Promise<string[]> {
  try {
    await ensurePricingTables();
    const [rate, products] = await Promise.all([
      getGbpToPkr(),
      prisma.product.findMany({
        where: { status: "ACTIVE", OR: [{ compareAtCents: { not: null } }, { ukPrice: { isNot: null } }] },
        select: { id: true, priceCents: true, compareAtCents: true, ukPrice: { select: { pence: true } } },
      }),
    ]);
    return products
      .filter((p) => {
        const pct = discountPercent(p.priceCents, p.compareAtCents) ?? compareWithUk(p.priceCents, p.ukPrice?.pence, rate)?.savePct;
        return pct != null && pct >= min && pct <= max;
      })
      .map((p) => p.id);
  } catch (err) {
    console.error("[pricing] Couldn't load discounts.", err);
    return [];
  }
}
