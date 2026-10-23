"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { ensurePricingTables } from "@/lib/pricing/uk-price";
import { matchUkPrices } from "@/lib/pricing/uk-import";

export type PricingResult = { ok: boolean; message?: string };

const ukSchema = z.object({
  pounds: z.string().trim().regex(/^(\d{1,5}(\.\d{1,2})?)?$/, "Enter the UK price in pounds, e.g. 48 or 50.97."),
  /** left out (quick edit in the products list) = keep the existing note */
  source: z.string().trim().max(500).optional(),
  /**
   * Quick edit from the products list: skip revalidation, which would also refresh the list and drop the
   * row from the "Missing UK price" view mid-edit. Shop pages are rendered per request, so they still
   * show the new price straight away.
   */
  quick: z.boolean().optional(),
});

/** Admin → Products → UK price: the product's real UK retail price (empty = remove). */
export async function setUkPrice(productId: string, input: unknown): Promise<PricingResult> {
  const user = await requireStaff();
  const parsed = ukSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the price." };
  await ensurePricingTables();
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, slug: true } });
  if (!product) return { ok: false, message: "Product not found." };

  const { pounds, source, quick } = parsed.data;
  const before = await prisma.ukPrice.findUnique({ where: { productId }, select: { pence: true } });
  if (!pounds) {
    await prisma.ukPrice.deleteMany({ where: { productId } });
  } else {
    const pence = Math.round(Number(pounds) * 100);
    if (pence <= 0) return { ok: false, message: "Enter a price above zero." };
    await prisma.ukPrice.upsert({
      where: { productId },
      update: { pence, ...(source === undefined ? {} : { source: source || null }) },
      create: { productId, pence, source: source || null },
    });
  }
  await logAudit(user.id, "product.uk_price", "Product", productId, { from: before?.pence ?? null, to: pounds ? Math.round(Number(pounds) * 100) : null, source });
  if (!quick) {
    revalidatePath(`/products/${product.slug}`);
    revalidatePath("/", "layout");
  }
  return { ok: true, message: pounds ? "Saved." : "UK price removed." };
}

/** Admin → Settings: rupees per pound for showing UK prices. */
export async function setGbpToPkr(input: unknown): Promise<PricingResult> {
  const user = await requireAdmin();
  const parsed = z.object({ gbpToPkr: z.coerce.number().min(50).max(5000) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter the rate in rupees per pound, e.g. 360." };
  await ensurePricingTables();
  await prisma.pricingSettings.upsert({ where: { id: "singleton" }, update: parsed.data, create: { id: "singleton", ...parsed.data } });
  await logAudit(user.id, "settings.gbp_to_pkr", "PricingSettings", "singleton", parsed.data);
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

// ── Bulk import (Admin → Products → Import UK prices) ──────────────────────

const pairsSchema = z
  .array(z.object({ sku: z.string().trim().min(1).max(100), pounds: z.number().positive().max(100000) }))
  .min(1, "No rows with a SKU and a UK price were found.")
  .max(10000);

export async function previewUkImport(pairs: unknown) {
  await requireStaff();
  const parsed = pairsSchema.safeParse(pairs);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Nothing to import." };
  await ensurePricingTables();
  return { ok: true as const, preview: await matchUkPrices(parsed.data) };
}

export async function importUkPrices(pairs: unknown): Promise<PricingResult & { saved?: number }> {
  const user = await requireStaff();
  const parsed = pairsSchema.safeParse(pairs);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Nothing to import." };
  await ensurePricingTables();
  const { rows } = await matchUkPrices(parsed.data);
  if (rows.length === 0) return { ok: false, message: "None of the SKUs matched a product." };
  const source = `Imported ${new Date().toISOString().slice(0, 10)}`;
  for (let i = 0; i < rows.length; i += 200) {
    await prisma.$transaction(
      rows.slice(i, i + 200).map((r) =>
        prisma.ukPrice.upsert({
          where: { productId: r.productId },
          update: { pence: Math.round(r.pounds * 100), source },
          create: { productId: r.productId, pence: Math.round(r.pounds * 100), source },
        }),
      ),
    );
  }
  await logAudit(user.id, "product.uk_price_import", "UkPrice", undefined, { saved: rows.length });
  revalidatePath("/", "layout");
  return { ok: true, saved: rows.length, message: `Saved UK prices for ${rows.length} products.` };
}
