/**
 * Colour bundles: buy at least `minColours` different colours of the same product (same design) and
 * `percentOff` comes off all of those items, e.g. one T-shirt Rs 2,000, five colours Rs 9,000 at 10% off.
 * One or two colours of a design get no bundle price. Shared by the product page, bag, checkout and order,
 * so the shopper always sees the price they pay. Pure: safe in the browser and on the server.
 */
export type BundleConfig = { enabled: boolean; minColours: number; percentOff: number };

export const DEFAULT_BUNDLE: BundleConfig = { enabled: true, minColours: 3, percentOff: 10 };

export type BundleLine = { productId: string; title: string; color: string | null; lineTotalCents: number };

export type BundleGroup = { productId: string; title: string; colours: string[]; cents: number };

/** Same colour however it was typed ("Red", " red "). */
export const colourKey = (c: string) => c.trim().toLowerCase();

/** The saving on `cents` worth of bundled items. */
export const bundleSaving = (cents: number, cfg: BundleConfig) => Math.round((cents * cfg.percentOff) / 100);

/** The bundle savings in a bag: one group per product with enough different colours. */
export function bundleDiscounts(lines: BundleLine[], cfg: BundleConfig): { cents: number; groups: BundleGroup[] } {
  if (!cfg.enabled || cfg.percentOff <= 0) return { cents: 0, groups: [] };
  const byProduct = new Map<string, { title: string; colours: Map<string, string>; total: number }>();
  for (const l of lines) {
    if (!l.color?.trim()) continue;
    const g = byProduct.get(l.productId) ?? { title: l.title, colours: new Map(), total: 0 };
    if (!g.colours.has(colourKey(l.color))) g.colours.set(colourKey(l.color), l.color.trim());
    g.total += l.lineTotalCents;
    byProduct.set(l.productId, g);
  }
  const groups: BundleGroup[] = [];
  for (const [productId, g] of byProduct) {
    if (g.colours.size < cfg.minColours) continue;
    groups.push({ productId, title: g.title, colours: [...g.colours.values()], cents: bundleSaving(g.total, cfg) });
  }
  return { cents: groups.reduce((s, g) => s + g.cents, 0), groups };
}

/** How many different colours of each product are in the bag. */
export function coloursInBag(lines: BundleLine[]): Map<string, number> {
  const seen = new Map<string, Set<string>>();
  for (const l of lines) {
    if (!l.color?.trim()) continue;
    const s = seen.get(l.productId) ?? new Set<string>();
    s.add(colourKey(l.color));
    seen.set(l.productId, s);
  }
  return new Map([...seen].map(([id, s]) => [id, s.size]));
}
