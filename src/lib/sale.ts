import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { discountPercent } from "@/lib/money";

/**
 * The 11.11 sale: the red "11.11" in the menu, the sale wording on the homepage banner, the poster that
 * pops up at the homepage rail, and the /sale page. All of it shows only between `starts` and `ends`
 * (Pakistan time), and only while some products are discounted.
 *
 * A product is in the sale when it has a real discount set in Admin → Products: a compare-at price above
 * its price. "Up to N% off" is worked out from those discounts, so it always matches the shop.
 */
export const SALE = {
  name: "11.11",
  title: "11.11 Sale",
  href: "/sale",
  starts: new Date("2026-11-11T00:00:00+05:00"),
  /** the first moment after the sale (it runs to the end of 20 November) */
  ends: new Date("2026-11-21T00:00:00+05:00"),
  lastDay: "20 November",
  poster: { src: "/images/sale/sale-1111-poster-v1.webp", width: 1024, height: 1536 },
} as const;

export { SALE_NAV_SLUG } from "@/lib/sale-nav";

export function saleDatesOn(now = new Date()) {
  return now >= SALE.starts && now < SALE.ends;
}

export type SaleStats = { count: number; maxPct: number };

/** How many products are discounted, and the biggest discount. Refreshed when products are saved (tag "nav"). */
const saleStats = unstable_cache(
  async (): Promise<SaleStats> => {
    const rows = await prisma.product.findMany({
      where: { status: "ACTIVE", compareAtCents: { gt: prisma.product.fields.priceCents } },
      select: { priceCents: true, compareAtCents: true },
    });
    const pcts = rows.map((r) => discountPercent(r.priceCents, r.compareAtCents) ?? 0);
    return { count: rows.length, maxPct: pcts.length ? Math.max(...pcts) : 0 };
  },
  ["sale-stats"],
  { tags: ["nav"], revalidate: 300 },
);

/** The sale while it's on and has products, else null. */
export async function activeSale(): Promise<SaleStats | null> {
  if (!saleDatesOn()) return null;
  try {
    const stats = await saleStats();
    return stats.count > 0 ? stats : null;
  } catch (err) {
    console.error("[sale] Couldn't load the sale's products.", err);
    return null;
  }
}
