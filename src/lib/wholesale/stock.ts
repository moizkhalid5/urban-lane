import "server-only";
import { prisma } from "@/lib/prisma";
import { departmentOf } from "@/lib/seo/copy";

/**
 * What we have in stock, for the wholesale page (/wholesale) and its downloadable list: every live product
 * (status ACTIVE: drafts and archived/private products are left out) with at least one piece in stock, with
 * its pieces per size and colour.
 */
export type StockSize = { label: string; stock: number };
export type StockItem = {
  id: string;
  title: string;
  slug: string;
  brand: string;
  /** "women", "men", "kids", "beauty", "jewellery" or "other" */
  department: string;
  /** the product's most specific category, e.g. "Coats & Jackets" */
  category: string;
  image: string | null;
  /** current shop price, base-currency minor units */
  priceMinor: number;
  pieces: number;
  sizes: StockSize[];
};

export type StockGroup = { name: string; pieces: number; styles: number };

export type WholesaleStock = {
  items: StockItem[];
  pieces: number;
  styles: number;
  brands: StockGroup[];
  departments: StockGroup[];
};

const OTHER = "other";

export async function getWholesaleStock(): Promise<WholesaleStock> {
  const rows = await prisma.product.findMany({
    where: { status: "ACTIVE", variants: { some: { isActive: true, stock: { gt: 0 } } } },
    select: {
      id: true,
      title: true,
      slug: true,
      gender: true,
      priceCents: true,
      brand: { select: { name: true } },
      images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
      categories: { select: { category: { select: { name: true, slug: true, level: true } } } },
      variants: {
        where: { isActive: true, stock: { gt: 0 } },
        select: { label: true, size: true, color: true, stock: true },
        orderBy: { position: "asc" },
      },
    },
  });

  const items: StockItem[] = rows.map((p) => {
    const cats = p.categories.map((c) => c.category).sort((a, b) => b.level - a.level);
    const deepest = cats.find((c) => c.level > 0 && c.name.toLowerCase() !== "other") ?? cats[0];
    // "Medium" when the product comes in one colour; "Medium / Navy" when its stock is in several colours.
    // The same size and colour listed twice (e.g. "small" and "Small") counts once, with both stocks added.
    const colours = new Set(p.variants.map((v) => v.color?.trim().toLowerCase()).filter(Boolean));
    const merged = new Map<string, StockSize>();
    for (const v of p.variants) {
      const size = v.size?.trim();
      const colour = v.color?.trim();
      const label =
        (colours.size > 1 ? [size, colour].filter(Boolean).join(" / ") : size || colour) || v.label?.trim() || "One size";
      const key = label.toLowerCase();
      const seen = merged.get(key);
      if (seen) seen.stock += v.stock;
      else merged.set(key, { label: label.charAt(0).toUpperCase() + label.slice(1), stock: v.stock });
    }
    const sizes = [...merged.values()];
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      brand: p.brand?.name ?? "Other brands",
      department: departmentOf(p.gender, cats.map((c) => c.slug)) ?? OTHER,
      category: deepest?.name ?? "Other",
      image: p.images[0]?.url ?? null,
      priceMinor: p.priceCents,
      pieces: sizes.reduce((n, s) => n + s.stock, 0),
      sizes,
    };
  });
  items.sort((a, b) => b.pieces - a.pieces || a.brand.localeCompare(b.brand) || a.title.localeCompare(b.title));

  const group = (key: (i: StockItem) => string) => {
    const map = new Map<string, StockGroup>();
    for (const i of items) {
      const g = map.get(key(i)) ?? { name: key(i), pieces: 0, styles: 0 };
      g.pieces += i.pieces;
      g.styles += 1;
      map.set(key(i), g);
    }
    return [...map.values()].sort((a, b) => b.pieces - a.pieces);
  };

  return {
    items,
    pieces: items.reduce((n, i) => n + i.pieces, 0),
    styles: items.length,
    brands: group((i) => i.brand),
    departments: group((i) => i.department),
  };
}
