"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { ensureReviewTables } from "@/lib/reviews/db";

export type SalesHistoryResult = { ok: boolean; message?: string };

const schema = z.object({
  units: z.coerce.number().int().min(0, "Enter 0 or more.").max(1_000_000),
  note: z.string().trim().max(200).optional().default(""),
});

/** Admin → Products → Sales history: units sold before the website (in store, WhatsApp, other marketplaces). */
export async function setPriorSales(productId: string, input: unknown): Promise<SalesHistoryResult> {
  const user = await requireStaff();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a whole number." };
  await ensureReviewTables();
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, slug: true } });
  if (!product) return { ok: false, message: "Product not found." };

  const { units, note } = parsed.data;
  const before = await prisma.priorSales.findUnique({ where: { productId }, select: { units: true } });
  await prisma.priorSales.upsert({
    where: { productId },
    update: { units, note: note || null },
    create: { productId, units, note: note || null },
  });
  await logAudit(user.id, "product.prior_sales", "Product", productId, { from: before?.units ?? 0, to: units, note });
  revalidatePath(`/products/${product.slug}`);
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}
