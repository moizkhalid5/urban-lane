import { prisma } from "@/lib/prisma";
import { nonEmptyCategoryIds } from "@/lib/queries/categories";

/**
 * Which listing pages are worth Google's time. A page that lists nothing (an empty category, a brand with
 * no live products) or only a leftover bucket ("Other") is thin: it stays reachable for shoppers but is
 * kept out of the sitemap and marked noindex, so Google spends its crawl on pages that can rank.
 */

/** Leftover buckets like "Other" under Dresses: real products, but no search demand for the page itself. */
export const isCatchAllCategory = (name: string) => /^(other|others|misc|miscellaneous)$/i.test(name.trim());

/** Category ids that deserve indexing: active, not virtual, not a catch-all, with live products (incl. sub-categories). */
export async function indexableCategoryIds(): Promise<Set<string>> {
  const [nonEmpty, categories] = await Promise.all([
    nonEmptyCategoryIds(),
    prisma.category.findMany({ where: { isActive: true, isVirtual: false }, select: { id: true, name: true } }),
  ]);
  return new Set(categories.filter((c) => nonEmpty.has(c.id) && !isCatchAllCategory(c.name)).map((c) => c.id));
}

/** Live products per brand id. */
export async function brandProductCounts(): Promise<Map<string, number>> {
  const rows = await prisma.product.groupBy({ by: ["brandId"], where: { status: "ACTIVE" }, _count: { _all: true } });
  return new Map(rows.filter((r) => r.brandId).map((r) => [r.brandId as string, r._count._all]));
}
