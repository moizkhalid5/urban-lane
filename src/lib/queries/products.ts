import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toCardList } from "@/lib/queries/to-card";
import { decorateCards } from "@/lib/queries/decorate-cards";
import { sizesMatchAges } from "@/lib/kids-age";
import { compareSizes, normalizeSize } from "@/lib/sizes";
import { productIdsWithDiscount } from "@/lib/pricing/uk-price";

export type ProductCard = {
  id: string;
  title: string;
  slug: string;
  brand: string | null;
  priceCents: number;
  compareAtCents: number | null;
  image: string | null;
  secondImage: string | null;
  inStock: boolean;
  isOutlet: boolean;
  colors: { name: string; hex: string | null }[];
  /** real units sold (from orders) */
  salesCount: number;
  /** average and count of approved reviews, once the product meets the admin's minimum (lib/reviews) */
  rating: { average: number; count: number } | null;
  /** units sold, once the product meets the admin's minimum; otherwise null */
  sold: number | null;
  /** the product's real UK price in rupees and the saving, when ours is lower (lib/pricing/uk-price) */
  ukPrice: { cents: number; savePct: number } | null;
};

export type ProductSort = "latest" | "price-asc" | "price-desc" | "featured" | "best-selling";

export type ProductFilter = {
  categorySlug?: string;
  brandSlugs?: string[];
  sizes?: string[];
  /** Kids age bands (keys of AGE_BANDS in lib/kids-age), matched against size labels. */
  ages?: string[];
  colors?: string[];
  minCents?: number;
  maxCents?: number;
  inStockOnly?: boolean;
  saleOnly?: boolean;
  gender?: string;
  /** several departments at once, e.g. the sale banner → Men, Women and Kids */
  genders?: string[];
  /** only products showing a discount in this range (%), from a sale or the UK price (?save=25-35) */
  save?: { min: number; max: number };
  q?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  /** skip this many products instead of whole pages (the scrolling product list loads more from here) */
  offset?: number;
};

const DEFAULT_PAGE_SIZE = 12;

/** Every stored spelling of the selected (normalised) sizes, e.g. "L" → ["L", "Large", "LARGE"]. */
async function rawSizesFor(selected: string[]): Promise<string[]> {
  const rows = await prisma.productVariant.findMany({ where: { size: { not: null } }, select: { size: true }, distinct: ["size"] });
  const wanted = new Set(selected);
  return rows.map((r) => r.size!).filter((raw) => wanted.has(normalizeSize(raw)));
}

/** Products with at least one active size label inside the given kids age bands. */
async function productIdsForAges(ages: string[]): Promise<string[]> {
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, size: { not: null }, product: { status: "ACTIVE" } },
    select: { productId: true, size: true },
  });
  const sizesByProduct = new Map<string, string[]>();
  for (const v of variants) sizesByProduct.set(v.productId, [...(sizesByProduct.get(v.productId) ?? []), v.size!]);
  return [...sizesByProduct].filter(([, sizes]) => sizesMatchAges(sizes, ages)).map(([id]) => id);
}

/** Resolve a category slug to itself + all descendants (path-prefixed slugs). */
async function descendantCategoryIds(slug: string): Promise<string[]> {
  const cats = await prisma.category.findMany({
    where: { OR: [{ slug }, { slug: { startsWith: `${slug}-` } }] },
    select: { id: true },
  });
  return cats.map((c) => c.id);
}

// Ends with the id so products that tie (same price, same import time) always come in the same order,
// and loading the list in batches never repeats or skips one.
function orderBy(sort?: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  return [...sortOrder(sort), { id: "asc" }];
}

function sortOrder(sort?: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ priceCents: "asc" }];
    case "price-desc":
      return [{ priceCents: "desc" }];
    case "best-selling":
      return [{ salesCount: "desc" }, { createdAt: "desc" }];
    case "featured":
      return [{ isFeatured: "desc" }, { salesCount: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }];
    default:
      return [{ publishedAt: "desc" }, { createdAt: "desc" }];
  }
}

async function buildWhere(f: ProductFilter): Promise<Prisma.ProductWhereInput> {
  const where: Prisma.ProductWhereInput = { status: "ACTIVE" };
  const and: Prisma.ProductWhereInput[] = [];

  // Outlet is virtual: the "outlet" collection means on-sale products.
  if (f.categorySlug === "outlet") {
    where.isOutlet = true;
  } else if (f.categorySlug) {
    const ids = await descendantCategoryIds(f.categorySlug);
    and.push({ categories: { some: { categoryId: { in: ids } } } });
  }

  if (f.gender) where.gender = f.gender;
  else if (f.genders?.length) where.gender = { in: f.genders };
  if (f.saleOnly) where.isOutlet = true;
  if (f.brandSlugs?.length) and.push({ brand: { slug: { in: f.brandSlugs } } });

  if (f.minCents != null || f.maxCents != null) {
    where.priceCents = {
      ...(f.minCents != null ? { gte: f.minCents } : {}),
      ...(f.maxCents != null ? { lte: f.maxCents } : {}),
    };
  }

  if (f.sizes?.length) and.push({ variants: { some: { size: { in: await rawSizesFor(f.sizes) }, isActive: true } } });
  if (f.ages?.length) and.push({ id: { in: await productIdsForAges(f.ages) } });
  if (f.save) and.push({ id: { in: await productIdsWithDiscount(f.save.min, f.save.max) } });
  if (f.colors?.length) and.push({ variants: { some: { color: { in: f.colors }, isActive: true } } });
  if (f.inStockOnly) and.push({ variants: { some: { stock: { gt: 0 }, isActive: true } } });

  if (f.q) {
    const q = f.q.trim();
    and.push({
      // MySQL string comparisons are case-insensitive by default (utf8mb4_*_ci),
      // so `mode: insensitive` is unnecessary (and unsupported by the MySQL connector).
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { brand: { name: { contains: q } } },
        { productType: { contains: q } },
      ],
    });
  }

  if (and.length) where.AND = and;
  return where;
}

const cardInclude = {
  brand: { select: { name: true } },
  images: { orderBy: { position: "asc" }, take: 2 },
  variants: { where: { isActive: true }, select: { color: true, colorHex: true, stock: true } },
} satisfies Prisma.ProductInclude;

export async function listProducts(f: ProductFilter) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = f.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = await buildWhere(f);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: cardInclude,
      orderBy: orderBy(f.sort),
      skip: f.offset ?? (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: await decorateCards(toCardList(items)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Filter facets (available brands/sizes/colors/price range) within a category scope. */
export async function getFacets(categorySlug?: string) {
  const scope: Prisma.ProductWhereInput = { status: "ACTIVE" };
  if (categorySlug === "outlet") {
    scope.isOutlet = true;
  } else if (categorySlug) {
    const ids = await descendantCategoryIds(categorySlug);
    scope.categories = { some: { categoryId: { in: ids } } };
  }

  const products = await prisma.product.findMany({
    where: scope,
    select: {
      priceCents: true,
      brand: { select: { name: true, slug: true } },
      variants: { where: { isActive: true }, select: { size: true, color: true, colorHex: true } },
    },
  });

  const brands = new Map<string, string>();
  const sizes = new Set<string>();
  const colors = new Map<string, string | null>();
  let min = Infinity;
  let max = 0;

  for (const p of products) {
    if (p.brand) brands.set(p.brand.slug, p.brand.name);
    min = Math.min(min, p.priceCents);
    max = Math.max(max, p.priceCents);
    for (const v of p.variants) {
      if (v.size) sizes.add(normalizeSize(v.size));
      // Colour matching in MySQL is case-insensitive, so one entry per spelling is enough.
      if (v.color && ![...colors.keys()].some((c) => c.toLowerCase() === v.color!.toLowerCase())) colors.set(v.color, v.colorHex);
    }
  }

  return {
    brands: [...brands.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name)),
    sizes: [...sizes].sort(compareSizes),
    colors: [...colors.entries()].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name)),
    minCents: Number.isFinite(min) ? min : 0,
    maxCents: max,
  };
}
