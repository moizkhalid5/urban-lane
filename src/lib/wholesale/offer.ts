/**
 * The wholesale offer for business owners (the /wholesale page, its stock list and the outreach messages):
 * a discount off the shop price that depends on the size of the whole order, mixing any products and brands.
 *
 * - 100 pieces or more in total: flat 50% off
 * - fewer than 100 pieces: 40% off
 *
 * The discount is taken off the current shop price (not a "was" price), so a wholesale price is never above
 * what a shopper pays today. Safe to use in the browser (no database).
 */
export const WHOLESALE_OFFER = {
  /** pieces in the whole order for the bigger discount */
  bulkMinPieces: 100,
  /** % off for orders of bulkMinPieces or more */
  bulkPct: 50,
  /** % off for smaller orders */
  basePct: 40,
} as const;

/** The % off for an order of this many pieces in total. */
export function offerPct(totalPieces: number): number {
  return totalPieces >= WHOLESALE_OFFER.bulkMinPieces ? WHOLESALE_OFFER.bulkPct : WHOLESALE_OFFER.basePct;
}

/** A shop price (minor units) with `pct` off, rounded to whole rupees. */
export function wholesaleMinor(shopMinor: number, pct: number): number {
  return Math.round((shopMinor * (100 - pct)) / 100 / 100) * 100;
}

/** The offer in words, one line per tier (for messages). */
export function offerText(): string {
  const o = WHOLESALE_OFFER;
  return [
    `${o.bulkMinPieces}+ pieces in total: flat ${o.bulkPct}% off our shop prices`,
    `Under ${o.bulkMinPieces} pieces: ${o.basePct}% off`,
    "Mix any products and brands; the total counts.",
  ].join("\n");
}
