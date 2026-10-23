import { prisma } from "@/lib/prisma";
import { compareWithUk, getGbpToPkr } from "./uk-price";

/**
 * Bulk UK price import (Admin → Products → Import UK prices). The browser reads the pasted sheet and sends
 * (SKU, UK price in £) pairs; here they're matched to products by SKU: the product's SKU, or the first
 * part of an "Urbanlane SKU" like "707-731 C8/R3 35R". A product listed several times (one row per size)
 * takes its first price.
 */
export type UkPair = { sku: string; pounds: number };

export type UkImportRow = {
  productId: string;
  title: string;
  sku: string;
  pounds: number;
  ourPrice: number; // rupees
  ukRupees: number;
  savePct: number | null; // null = ours isn't lower, so no comparison is shown
  previousPounds: number | null;
};

export type UkImportPreview = {
  rows: UkImportRow[];
  notFound: string[];
  rate: number;
};

export async function matchUkPrices(pairs: UkPair[]): Promise<UkImportPreview> {
  const [products, rate, existing] = await Promise.all([
    prisma.product.findMany({ where: { sku: { not: null } }, select: { id: true, title: true, sku: true, priceCents: true } }),
    getGbpToPkr(),
    prisma.ukPrice.findMany({ select: { productId: true, pence: true } }),
  ]);
  const bySku = new Map(products.map((p) => [p.sku!.trim().toLowerCase(), p]));
  const previous = new Map(existing.map((e) => [e.productId, e.pence / 100]));
  const rows = new Map<string, UkImportRow>();
  const notFound = new Set<string>();
  for (const { sku, pounds } of pairs) {
    const key = sku.trim().toLowerCase();
    const product = bySku.get(key) ?? bySku.get(key.split(/\s+/)[0]);
    if (!product) {
      notFound.add(sku.trim());
      continue;
    }
    if (rows.has(product.id) || !(pounds > 0)) continue;
    const c = compareWithUk(product.priceCents, Math.round(pounds * 100), rate);
    rows.set(product.id, {
      productId: product.id,
      title: product.title,
      sku: product.sku!,
      pounds,
      ourPrice: product.priceCents / 100,
      ukRupees: Math.round(((pounds * rate) / 100)) * 100,
      savePct: c?.savePct ?? null,
      previousPounds: previous.get(product.id) ?? null,
    });
  }
  return { rows: [...rows.values()], notFound: [...notFound], rate };
}
