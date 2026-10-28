"use server";

import { listProducts, type ProductCard } from "@/lib/queries/products";
import { getActiveCurrency } from "@/lib/currency.server";
import { feedFilter, type FeedSource } from "@/lib/queries/product-feed";
import type { RawSearchParams } from "@/lib/queries/parse-filters";

/** The next products of a listing, from `offset` (see lib/queries/product-feed.ts). */
export async function loadMoreProducts(source: FeedSource, sp: RawSearchParams, offset: number, limit: number): Promise<ProductCard[]> {
  const currency = await getActiveCurrency();
  const { products } = await listProducts({
    ...feedFilter(source, sp, currency),
    offset: Math.max(0, Math.floor(offset)),
    pageSize: Math.min(Math.max(1, Math.floor(limit)), 240),
  });
  return products;
}
