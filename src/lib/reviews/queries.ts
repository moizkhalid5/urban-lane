import { prisma } from "@/lib/prisma";
import type { ProductCard } from "@/lib/queries/products";
import { ensureReviewTables, getReviewSettings, visibleReviewWhere } from "./db";

export type RatingSummary = { average: number; count: number };

export type PublicReview = {
  id: string;
  authorName: string;
  authorCity: string | null;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  isSample: boolean;
  reviewedAt: string; // ISO
  product: { title: string; slug: string } | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Average rating and review count per product, from approved reviews. */
export async function ratingsFor(productIds: string[]): Promise<Map<string, RatingSummary>> {
  const map = new Map<string, RatingSummary>();
  if (productIds.length === 0) return map;
  await ensureReviewTables();
  const rows = await prisma.review.groupBy({
    by: ["productId"],
    where: { ...visibleReviewWhere(), productId: { in: productIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const r of rows) {
    if (r.productId) map.set(r.productId, { average: round1(r._avg.rating ?? 0), count: r._count._all });
  }
  return map;
}

/** Units sold before the website, per product (Admin → Products → Sales history). */
export async function priorSalesFor(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  await ensureReviewTables();
  const rows = await prisma.priorSales.findMany({ where: { productId: { in: productIds } }, select: { productId: true, units: true } });
  return new Map(rows.map((r) => [r.productId, r.units]));
}

/**
 * Adds the star rating and "N sold" to product cards, following Admin → Reviews settings: stars from
 * `minReviewsForStars` approved reviews, "sold" (website orders + sales before the website) from `minSoldToShow`. If reviews can't be
 * read, cards are returned unchanged (never breaks a listing).
 */
export async function withRatings(cards: ProductCard[]): Promise<ProductCard[]> {
  if (cards.length === 0) return cards;
  try {
    const ids = cards.map((c) => c.id);
    const [settings, ratings, prior] = await Promise.all([getReviewSettings(), ratingsFor(ids), priorSalesFor(ids)]);
    return cards.map((c) => {
      const r = ratings.get(c.id);
      const sold = c.salesCount + (prior.get(c.id) ?? 0);
      return {
        ...c,
        rating: r && r.count >= Math.max(1, settings.minReviewsForStars) ? r : null,
        sold: sold >= Math.max(1, settings.minSoldToShow) ? sold : null,
      };
    });
  } catch (err) {
    console.error("[reviews] Couldn't add ratings to product cards.", err);
    return cards;
  }
}

function toPublic(r: {
  id: string;
  authorName: string;
  authorCity: string | null;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  isSample: boolean;
  reviewedAt: Date;
  product?: { title: string; slug: string } | null;
}): PublicReview {
  return {
    id: r.id,
    authorName: r.authorName,
    authorCity: r.authorCity,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verifiedPurchase: r.verifiedPurchase,
    isSample: r.isSample,
    reviewedAt: r.reviewedAt.toISOString(),
    product: r.product ?? null,
  };
}

export type ProductReviews = {
  summary: RatingSummary;
  /** count of 5★, 4★, 3★, 2★, 1★ reviews */
  distribution: [number, number, number, number, number];
  reviews: PublicReview[];
  /** whether the stars should be shown (meets the admin's minimum) */
  showStars: boolean;
  sold: number | null;
  allowCustomerReviews: boolean;
  /** summary of real (non-sample) reviews only, for search engines */
  realSummary: RatingSummary;
};

export async function getProductReviews(productId: string, salesCount: number): Promise<ProductReviews> {
  const [settings, prior] = await Promise.all([getReviewSettings(), priorSalesFor([productId]).catch(() => new Map<string, number>())]);
  const totalSold = salesCount + (prior.get(productId) ?? 0);
  const sold = totalSold >= Math.max(1, settings.minSoldToShow) ? totalSold : null;
  const empty: ProductReviews = {
    summary: { average: 0, count: 0 },
    distribution: [0, 0, 0, 0, 0],
    reviews: [],
    showStars: false,
    sold,
    allowCustomerReviews: settings.allowCustomerReviews,
    realSummary: { average: 0, count: 0 },
  };
  try {
    await ensureReviewTables();
    const rows = await prisma.review.findMany({
      where: { ...visibleReviewWhere(), productId },
      orderBy: { reviewedAt: "desc" },
      take: 200,
    });
    if (rows.length === 0) return empty;
    const distribution: ProductReviews["distribution"] = [0, 0, 0, 0, 0];
    for (const r of rows) distribution[5 - Math.min(5, Math.max(1, r.rating))] += 1;
    const avg = (list: typeof rows) => (list.length ? round1(list.reduce((s, r) => s + r.rating, 0) / list.length) : 0);
    const real = rows.filter((r) => !r.isSample);
    return {
      ...empty,
      summary: { average: avg(rows), count: rows.length },
      distribution,
      reviews: rows.map(toPublic),
      showStars: rows.length >= Math.max(1, settings.minReviewsForStars),
      realSummary: { average: avg(real), count: real.length },
    };
  } catch (err) {
    console.error("[reviews] Couldn't load product reviews.", err);
    return empty;
  }
}

/**
 * Reviews for the homepage carousel: the ones ticked "Show on homepage" in Admin → Reviews, in the
 * admin's order. If none are ticked yet, the latest 4★ and 5★ reviews.
 */
export async function getHomepageReviews(limit = 15): Promise<PublicReview[]> {
  try {
    await ensureReviewTables();
    const include = { product: { select: { title: true, slug: true } } };
    const featured = await prisma.review.findMany({
      where: { ...visibleReviewWhere(), featured: true },
      orderBy: [{ featuredPosition: "asc" }, { reviewedAt: "desc" }],
      include,
      take: limit,
    });
    if (featured.length > 0) return featured.map(toPublic);
    const latest = await prisma.review.findMany({
      where: { ...visibleReviewWhere(), rating: { gte: 4 } },
      orderBy: { reviewedAt: "desc" },
      include,
      take: limit,
    });
    return latest.map(toPublic);
  } catch (err) {
    console.error("[reviews] Couldn't load homepage reviews.", err);
    return [];
  }
}
