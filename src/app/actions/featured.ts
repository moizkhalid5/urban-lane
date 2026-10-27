"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { MAX_FEATURED_PICKS, ensureFeaturedTables, isFeaturedDepartment } from "@/lib/featured";

export type FeaturedResult = { ok: boolean; message?: string };

function revalidateFeatured() {
  revalidatePath("/");
  revalidatePath("/admin/featured");
}

/** Adds a product to the end of a department's row. */
export async function addFeaturedPick(department: string, productId: string): Promise<FeaturedResult> {
  const user = await requireStaff();
  if (!isFeaturedDepartment(department)) return { ok: false, message: "Unknown row." };
  await ensureFeaturedTables();
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, title: true } });
  if (!product) return { ok: false, message: "That product no longer exists." };
  const picks = await prisma.featuredPick.findMany({ where: { department }, select: { productId: true, position: true } });
  if (picks.some((p) => p.productId === productId)) return { ok: false, message: "That product is already in this row." };
  if (picks.length >= MAX_FEATURED_PICKS) return { ok: false, message: `A row holds up to ${MAX_FEATURED_PICKS} products. Remove one first.` };
  const position = Math.max(-1, ...picks.map((p) => p.position)) + 1;
  await prisma.featuredPick.create({ data: { department, productId, position } });
  await logAudit(user.id, "featured.add", "FeaturedPick", productId, { department, title: product.title });
  revalidateFeatured();
  return { ok: true };
}

export async function removeFeaturedPick(id: string): Promise<FeaturedResult> {
  const user = await requireStaff();
  await ensureFeaturedTables();
  const pick = await prisma.featuredPick.delete({ where: { id } }).catch(() => null);
  if (pick) await logAudit(user.id, "featured.remove", "FeaturedPick", pick.productId, { department: pick.department });
  revalidateFeatured();
  return { ok: true };
}

/** Moves a product one place left (-1) or right (1) within its row. */
export async function moveFeaturedPick(id: string, dir: -1 | 1): Promise<FeaturedResult> {
  await requireStaff();
  await ensureFeaturedTables();
  const pick = await prisma.featuredPick.findUnique({ where: { id } });
  if (!pick) return { ok: false, message: "That product is no longer in the row." };
  const row = await prisma.featuredPick.findMany({ where: { department: pick.department }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const i = row.findIndex((p) => p.id === id);
  const j = i + dir;
  if (j < 0 || j >= row.length) return { ok: true };
  [row[i], row[j]] = [row[j], row[i]];
  await prisma.$transaction(row.map((p, position) => prisma.featuredPick.update({ where: { id: p.id }, data: { position } })));
  revalidateFeatured();
  return { ok: true };
}
