import { prisma } from "@/lib/prisma";
import { ukComparisonsFor, type UkComparison } from "@/lib/pricing/uk-price";
import { compareSizes, normalizeSize } from "@/lib/sizes";
import { ensureRailTables, getRailSettings, railWord, type RailSettingsData } from "./db";

/** One garment on the homepage rail; price and sizes come live from its product. */
export type RailCard = {
  id: string;
  href: string;
  name: string;
  brand: string | null;
  word: string;
  front: string;
  side: string;
  priceCents: number;
  compareAtCents: number | null;
  uk: UkComparison | null;
  sizes: { label: string; inStock: boolean }[];
};

/** A tab above the rail ("Men's Suits") with its garments. */
export type RailTab = { id: string; name: string; items: RailCard[] };

/**
 * The rail for the homepage: shown collections, each with its shown garments that are linked to a product
 * on sale (status ACTIVE), in order. A collection needs at least 2 garments (a rail of one doesn't work);
 * collections without enough garments yet (e.g. "Kids' Suits" before its photos are added) are left out.
 * Null when the rail is switched off or no collection has enough garments.
 */
export async function getHomepageRail(): Promise<{ settings: RailSettingsData; collections: RailTab[] } | null> {
  try {
    const settings = await getRailSettings();
    if (!settings.enabled) return null;
    await ensureRailTables();
    const rows = await prisma.railItem.findMany({
      where: { isActive: true, product: { status: "ACTIVE" }, collection: { isActive: true } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        collection: { select: { id: true, name: true, position: true } },
        product: {
          select: {
            id: true,
            slug: true,
            title: true,
            priceCents: true,
            compareAtCents: true,
            brand: { select: { name: true } },
            variants: { where: { isActive: true }, select: { size: true, stock: true } },
          },
        },
      },
    });
    const items = rows.filter((r) => r.product && r.collection);
    const uk = await ukComparisonsFor(items.map((r) => r.product!));
    const cards = items.map((r) => {
      const p = r.product!;
      const sizes = new Map<string, boolean>();
      for (const v of p.variants) {
        if (!v.size) continue;
        const label = normalizeSize(v.size);
        sizes.set(label, (sizes.get(label) ?? false) || v.stock > 0);
      }
      return {
        id: r.id,
        href: `/products/${p.slug}`,
        name: p.title,
        brand: p.brand?.name ?? null,
        word: railWord(r.word, p.title),
        front: r.frontImage,
        side: r.sideImage,
        priceCents: p.priceCents,
        compareAtCents: p.compareAtCents,
        uk: uk.get(p.id) ?? null,
        sizes: [...sizes].sort(([a], [b]) => compareSizes(a, b)).map(([label, inStock]) => ({ label, inStock })),
      };
    });
    const tabs = new Map<string, RailTab & { position: number }>();
    items.forEach((r, i) => {
      const c = r.collection!;
      const tab = tabs.get(c.id) ?? { id: c.id, name: c.name, position: c.position, items: [] };
      tab.items.push(cards[i]);
      tabs.set(c.id, tab);
    });
    const collections = [...tabs.values()]
      .filter((t) => t.items.length >= 2)
      .sort((a, b) => a.position - b.position)
      .map(({ id, name, items }) => ({ id, name, items }));
    return collections.length ? { settings, collections } : null;
  } catch (err) {
    console.error("[rail] Couldn't load the homepage rail.", err);
    return null;
  }
}
