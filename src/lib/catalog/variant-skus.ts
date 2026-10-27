import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import seed from "./variant-skus-seed.json";

/**
 * Per-size SKUs from the "need to update SKUs" sheet: products that were imported with only their first
 * size get every size from the sheet, each with its own SKU and stock.
 *
 * A product is found by the SKU of its first size (Product.sku), or else by its exact title; `product` names
 * the product's SKU where it was imported under a later size and a different title. Then, per size:
 * - the size already exists → its empty SKU is filled in (stock and anything else stay as they are);
 * - the size is missing → it's added with the sheet's SKU and stock (the "Actual Stock" column, or
 *   "Quantity" where that's blank) and the colour of the product's existing size.
 * A size whose SKU already belongs to another product is skipped and reported, never moved. Sizes repeated
 * with the same SKU in the sheet carry no SKU here (null).
 */
type SeedProduct = { title: string; product?: string; colour: string | null; sizes: [sku: string | null, size: string, stock: number][] };

export type VariantSkuReport = {
  products: number;
  skusFilled: number;
  sizesAdded: number;
  notFound: string[];
  /** "<product>: <size> <sku> (already on <other product>)" */
  conflicts: string[];
};

const same = (a: string | null | undefined, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

export async function applyVariantSkus({ dryRun = false } = {}): Promise<VariantSkuReport> {
  const data = seed as SeedProduct[];
  const report: VariantSkuReport = { products: 0, skusFilled: 0, sizesAdded: 0, notFound: [], conflicts: [] };
  const allSkus = data.flatMap((p) => p.sizes.map(([sku]) => sku).filter((s): s is string => !!s));
  const [productSkus, variantSkus] = await Promise.all([
    prisma.product.findMany({ where: { sku: { in: allSkus } }, select: { id: true, sku: true, title: true } }),
    prisma.productVariant.findMany({ where: { sku: { in: allSkus } }, select: { sku: true, productId: true, product: { select: { title: true } } } }),
  ]);
  // Which product each SKU already belongs to
  const owner = new Map<string, { id: string; title: string }>();
  for (const p of productSkus) owner.set(p.sku!, { id: p.id, title: p.title });
  for (const v of variantSkus) owner.set(v.sku!, { id: v.productId, title: v.product.title });

  for (const item of data) {
    const first = item.product ?? item.sizes[0][0];
    const product =
      (first && (await prisma.product.findUnique({ where: { sku: first }, include: { variants: { orderBy: { position: "asc" } } } }))) ||
      (await prisma.product.findFirst({ where: { title: item.title }, include: { variants: { orderBy: { position: "asc" } } } }));
    if (!product) {
      report.notFound.push(item.title);
      continue;
    }
    report.products++;
    const colour = product.variants.find((v) => v.color)?.color ?? item.colour;
    let position = Math.max(-1, ...product.variants.map((v) => v.position));

    for (const [sku, size, stock] of item.sizes) {
      const taken = sku ? owner.get(sku) : undefined;
      // A SKU that's another product's: leave this size for a person to check
      if (sku && taken && taken.id !== product.id) {
        report.conflicts.push(`${product.title}: ${size} ${sku} (already on "${taken.title}")`);
        continue;
      }
      const skuOk = !!sku;

      // A product with one size-less variant: that variant is the first size.
      const sizeless = product.variants.length === 1 && !product.variants[0].size && size === item.sizes[0][1];
      const existing = product.variants.find((v) => same(v.size, size)) ?? (sizeless ? product.variants[0] : undefined);
      if (existing) {
        if (skuOk && !existing.sku && !product.variants.some((v) => v.sku === sku)) {
          if (!dryRun) await prisma.productVariant.update({ where: { id: existing.id }, data: { sku, ...(existing.size ? {} : { size }) } });
          existing.sku = sku;
          existing.size ??= size;
          report.skusFilled++;
        }
        continue;
      }
      if (!dryRun) {
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            size,
            color: colour,
            label: [size, colour].filter(Boolean).join(" / "),
            sku: skuOk ? sku : null,
            stock,
            position: ++position,
          },
        });
      }
      if (skuOk) owner.set(sku!, { id: product.id, title: product.title });
      report.sizesAdded++;
    }
  }
  return report;
}

/** Bump when variant-skus-seed.json is replaced with a newer sheet, so it runs again. */
const SEED_VERSION = "need to update SKUs 2026-10-28";

/** Runs the sheet once per SEED_VERSION (at server start, src/instrumentation.ts). Best-effort. */
export async function applyVariantSkusOnce(): Promise<void> {
  try {
    const done = await prisma.auditLog.findFirst({ where: { action: "variant_sku.seed", entityId: SEED_VERSION }, select: { id: true } });
    if (done) return;
    const report = await applyVariantSkus();
    await logAudit(undefined, "variant_sku.seed", "ProductVariant", SEED_VERSION, report);
    console.log("[catalog] Per-size SKUs added from the sheet:", JSON.stringify(report));
  } catch (err) {
    console.error("[catalog] Couldn't add the per-size SKUs from the sheet.", err);
  }
}
