import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { departmentOf, type Department } from "@/lib/seo/copy";

/**
 * Live facts about a listing page (a category with its sub-categories, or a brand), used in its search
 * title, description and on-page text: how many products, which brands lead, the price range, which
 * departments. Always from the current catalogue, so the wording never goes stale.
 */
export type ListingStats = {
  count: number;
  minCents: number | null;
  maxCents: number | null;
  onSale: number;
  maxDiscountPct: number;
  brands: { name: string; slug: string; count: number }[];
  departments: Department[];
};

async function stats(where: { categorySlug?: string; brandId?: string }): Promise<ListingStats> {
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      ...(where.brandId && { brandId: where.brandId }),
      ...(where.categorySlug && {
        categories: { some: { category: { OR: [{ slug: where.categorySlug }, { slug: { startsWith: `${where.categorySlug}-` } }] } } },
      }),
    },
    select: {
      priceCents: true,
      compareAtCents: true,
      gender: true,
      brand: { select: { name: true, slug: true } },
      categories: { select: { category: { select: { slug: true } } } },
    },
  });
  const brands = new Map<string, { name: string; slug: string; count: number }>();
  const departments = new Map<Department, number>();
  let onSale = 0;
  let maxDiscountPct = 0;
  for (const p of products) {
    if (p.brand) {
      const b = brands.get(p.brand.slug) ?? { ...p.brand, count: 0 };
      b.count += 1;
      brands.set(p.brand.slug, b);
    }
    const d = departmentOf(p.gender, p.categories.map((c) => c.category.slug));
    if (d) departments.set(d, (departments.get(d) ?? 0) + 1);
    if (p.compareAtCents && p.compareAtCents > p.priceCents) {
      onSale += 1;
      maxDiscountPct = Math.max(maxDiscountPct, Math.floor(((p.compareAtCents - p.priceCents) / p.compareAtCents) * 100));
    }
  }
  const prices = products.map((p) => p.priceCents);
  return {
    count: products.length,
    minCents: prices.length ? Math.min(...prices) : null,
    maxCents: prices.length ? Math.max(...prices) : null,
    onSale,
    maxDiscountPct,
    brands: [...brands.values()].sort((a, b) => b.count - a.count),
    departments: [...departments].sort((a, b) => b[1] - a[1]).map(([d]) => d),
  };
}

/** Per request (metadata and the page share one lookup). */
export const categoryStats = cache((slug: string) => stats({ categorySlug: slug }));
export const brandStats = cache((brandId: string) => stats({ brandId }));
