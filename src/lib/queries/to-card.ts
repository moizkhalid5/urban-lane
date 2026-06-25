import type { ProductCard } from "@/lib/queries/products";

/** Minimal shape needed to render a ProductCard. */
type CardRow = {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  compareAtCents: number | null;
  isOutlet: boolean;
  brand: { name: string } | null;
  images: { url: string }[];
  variants: { color: string | null; colorHex: string | null; stock: number }[];
};

export function toCard(p: CardRow): ProductCard {
  const colorMap = new Map<string, string | null>();
  for (const v of p.variants) {
    if (v.color && !colorMap.has(v.color)) colorMap.set(v.color, v.colorHex);
  }
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    brand: p.brand?.name ?? null,
    priceCents: p.priceCents,
    compareAtCents: p.compareAtCents,
    image: p.images[0]?.url ?? null,
    secondImage: p.images[1]?.url ?? null,
    inStock: p.variants.some((v) => v.stock > 0),
    isOutlet: p.isOutlet,
    colors: [...colorMap.entries()].map(([name, hex]) => ({ name, hex })),
  };
}

export function toCardList(rows: CardRow[]): ProductCard[] {
  return rows.map(toCard);
}
