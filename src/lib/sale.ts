import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { discountPercent } from "@/lib/money";

/**
 * The shop's sales (11.11, Black Friday): the red sale name in the menu, the sale wording on the homepage
 * banner, the poster that pops up at the homepage rail (11.11 only), and the sale's page. All of it shows only
 * between the sale's `starts` and `ends` (Pakistan time), and only while some products are discounted.
 *
 * A product is in the sale when it has a real discount set in Admin → Products: a compare-at price above
 * its price. "Up to N% off" is worked out from those discounts, so it always matches the shop.
 */
export type SaleEvent = {
  /** in the menu and on the homepage banner, e.g. "Black Friday" */
  name: string;
  title: string;
  href: string;
  starts: Date;
  /** the first moment after the sale */
  ends: Date;
  firstDay: string;
  lastDay: string;
  hashtag: string;
  /** the poster that pops up once per visitor at the homepage rail */
  poster?: { src: string; width: number; height: number };
};

export const ELEVEN_ELEVEN: SaleEvent = {
  name: "11.11",
  title: "11.11 Sale",
  href: "/sale",
  starts: new Date("2026-11-11T00:00:00+05:00"),
  // it runs to the end of 20 November
  ends: new Date("2026-11-21T00:00:00+05:00"),
  firstDay: "11 November",
  lastDay: "20 November",
  hashtag: "#1111Sale",
  poster: { src: "/images/sale/sale-1111-poster-v1.webp", width: 1024, height: 1536 },
};

/** Black Friday to Cyber Monday, with the same discounts as 11.11 (the compare-at prices set in Admin). */
export const BLACK_FRIDAY: SaleEvent = {
  name: "Black Friday",
  title: "Black Friday Sale",
  href: "/black-friday",
  starts: new Date("2026-11-27T00:00:00+05:00"),
  // it runs to the end of Monday 30 November
  ends: new Date("2026-12-01T00:00:00+05:00"),
  firstDay: "Friday 27 November",
  lastDay: "30 November",
  hashtag: "#BlackFriday",
};

export const SALES: SaleEvent[] = [ELEVEN_ELEVEN, BLACK_FRIDAY];
/** The 11.11 sale (its page is /sale). */
export const SALE = ELEVEN_ELEVEN;

export { SALE_NAV_SLUG } from "@/lib/sale-nav";

/** The sale running at `now`, if any. */
export function saleOn(now = new Date()): SaleEvent | null {
  return SALES.find((e) => now >= e.starts && now < e.ends) ?? null;
}

export function saleDatesOn(now = new Date()) {
  return !!saleOn(now);
}

export type SaleStats = { count: number; maxPct: number };

/** How many products are discounted, and the biggest discount. Refreshed when products are saved (tag "nav"). */
export const saleStats = unstable_cache(
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

export type ActiveSale = SaleStats & { event: SaleEvent };

/** The sale running now, while it has products, else null. */
export async function activeSale(): Promise<ActiveSale | null> {
  const event = saleOn();
  if (!event) return null;
  try {
    const stats = await saleStats();
    return stats.count > 0 ? { ...stats, event } : null;
  } catch (err) {
    console.error("[sale] Couldn't load the sale's products.", err);
    return null;
  }
}
