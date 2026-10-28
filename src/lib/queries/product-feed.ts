import type { DisplayCurrency } from "@/lib/money";
import type { ProductFilter } from "@/lib/queries/products";
import { parseFilters, type RawSearchParams } from "@/lib/queries/parse-filters";

/**
 * Product listings show one long list that loads more as the customer scrolls
 * (components/collection/ProductFeed.tsx), instead of numbered pages. A source says which list it is,
 * so the first batch (rendered by the page) and the later ones (actions/product-feed.ts) use the same
 * query.
 */
export type FeedSource =
  | { kind: "category"; slug: string }
  | { kind: "brand"; slug: string }
  | { kind: "offers" }
  | { kind: "search" };

/** Products per batch: six rows of four on computers. */
export const FEED_BATCH = 24;

export function feedFilter(source: FeedSource, sp: RawSearchParams, currency: DisplayCurrency): ProductFilter {
  const filter = parseFilters(sp, currency);
  switch (source.kind) {
    case "category":
      return { ...filter, categorySlug: source.slug };
    case "brand":
      return { ...filter, brandSlugs: [source.slug] };
    case "offers":
      // Every product that shows a discount, unless a range was chosen
      return { ...filter, save: filter.save ?? { min: 1, max: 100 } };
    case "search": {
      const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
      return { ...filter, q: q?.trim() ?? "" };
    }
  }
}
