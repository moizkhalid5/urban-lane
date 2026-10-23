import type { ProductCard } from "@/lib/queries/products";
import { withRatings } from "@/lib/reviews/queries";
import { ukComparisonsFor } from "@/lib/pricing/uk-price";

/** Adds what product cards show beyond the product itself: stars, "N sold" and the UK price comparison. */
export async function decorateCards(cards: ProductCard[]): Promise<ProductCard[]> {
  const [rated, uk] = await Promise.all([withRatings(cards), ukComparisonsFor(cards)]);
  return rated.map((c) => ({ ...c, ukPrice: uk.get(c.id) ?? null }));
}
