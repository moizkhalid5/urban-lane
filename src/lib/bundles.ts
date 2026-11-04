import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CartView } from "@/lib/cart";
import { bundleDiscounts, coloursInBag, colourKey, DEFAULT_BUNDLE, type BundleConfig, type BundleGroup } from "@/lib/bundle-rule";

/**
 * Colour bundles (rule in lib/bundle-rule.ts): the settings, the saving in the bag, and the saving recorded
 * on each order. Tables are created on first use (same SQL as prisma/migrations/20261106120000_colour_bundles),
 * because the host's deploy doesn't run migrations.
 */
const CREATE_SETTINGS = `CREATE TABLE IF NOT EXISTS \`BundleSettings\` (
    \`id\` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    \`enabled\` BOOLEAN NOT NULL DEFAULT true,
    \`minColours\` INTEGER NOT NULL DEFAULT 3,
    \`percentOff\` INTEGER NOT NULL DEFAULT 10,
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

const CREATE_ORDER_BUNDLE = `CREATE TABLE IF NOT EXISTS \`OrderBundle\` (
    \`orderId\` VARCHAR(191) NOT NULL,
    \`cents\` INTEGER NOT NULL,
    \`detail\` VARCHAR(1000) NOT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`orderId\`),
    CONSTRAINT \`OrderBundle_orderId_fkey\` FOREIGN KEY (\`orderId\`) REFERENCES \`Order\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

let ready: Promise<void> | null = null;
export function ensureBundleTables(): Promise<void> {
  ready ??= (async () => {
    await prisma.$executeRawUnsafe(CREATE_SETTINGS);
    await prisma.$executeRawUnsafe(CREATE_ORDER_BUNDLE);
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

/** The bundle settings (defaults until saved in Admin → Settings). Never throws: on a database problem
 *  bundles are switched off rather than breaking the shop. */
export const getBundleConfig = cache(async (): Promise<BundleConfig> => {
  try {
    await ensureBundleTables();
    const row = await prisma.bundleSettings.findUnique({ where: { id: "singleton" } });
    return row ? { enabled: row.enabled, minColours: row.minColours, percentOff: row.percentOff } : DEFAULT_BUNDLE;
  } catch (err) {
    console.error("[bundles] Couldn't read the bundle settings; bundles are off for this request.", err);
    return { ...DEFAULT_BUNDLE, enabled: false };
  }
});

/** A product in the bag that is short of a bundle by a colour or two. */
export type BundleHint = { productId: string; title: string; slug: string; missing: number };

export type BagBundle = { config: BundleConfig; cents: number; groups: BundleGroup[]; hints: BundleHint[] };

/** The bundle saving in the bag, plus a nudge for products one or two colours short of a bundle. */
export async function bagBundle(cart: CartView): Promise<BagBundle> {
  const config = await getBundleConfig();
  const lines = cart.lines.map((l) => ({ productId: l.productId, title: l.title, color: l.color, lineTotalCents: l.lineTotalCents }));
  const { cents, groups } = bundleDiscounts(lines, config);
  if (!config.enabled) return { config, cents, groups, hints: [] };

  const inBag = coloursInBag(lines);
  const short = [...inBag].filter(([, n]) => n < config.minColours).map(([id]) => id);
  let hints: BundleHint[] = [];
  if (short.length) {
    // Only nudge when the product has enough colours in stock to make up a bundle.
    const variants = await prisma.productVariant.findMany({
      where: { productId: { in: short }, isActive: true, stock: { gt: 0 }, color: { not: null } },
      select: { productId: true, color: true },
    });
    const available = new Map<string, Set<string>>();
    for (const v of variants) {
      if (!v.color?.trim()) continue;
      const s = available.get(v.productId) ?? new Set<string>();
      s.add(colourKey(v.color));
      available.set(v.productId, s);
    }
    hints = short.flatMap((id) => {
      if ((available.get(id)?.size ?? 0) < config.minColours) return [];
      const line = cart.lines.find((l) => l.productId === id)!;
      return [{ productId: id, title: line.title, slug: line.slug, missing: config.minColours - inBag.get(id)! }];
    });
  }
  return { config, cents, groups, hints };
}

export const bundleDetail = (groups: BundleGroup[]) =>
  groups
    .map((g) => `${g.title}: ${g.colours.join(", ")}`)
    .join("; ")
    .slice(0, 1000);

/** Records the bundle saving with a new order (inside the order's transaction). */
export async function saveOrderBundle(tx: Prisma.TransactionClient, orderId: string, cents: number, groups: BundleGroup[]) {
  if (cents <= 0) return;
  await tx.orderBundle.create({ data: { orderId, cents, detail: bundleDetail(groups) } });
}

/** The bundle saving on an order, for order pages; null when there was none. */
export async function getOrderBundle(orderId: string): Promise<{ cents: number; detail: string } | null> {
  try {
    await ensureBundleTables();
    return await prisma.orderBundle.findUnique({ where: { orderId }, select: { cents: true, detail: true } });
  } catch {
    return null;
  }
}
