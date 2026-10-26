"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { deleteFile } from "@/lib/storage";
import { ensureRailTables, isPlacement } from "@/lib/rail/db";

export type RailResult = { ok: boolean; message?: string; id?: string };

function revalidateRail() {
  revalidatePath("/");
  revalidatePath("/admin/rail");
}

/** Photos are uploaded first (/api/admin/upload?purpose=rail), which returns "/uploads/<file>". */
const imageUrl = z.string().regex(/^\/uploads\/[\w.-]+$/, "Upload the photo first.");

/** Removes a rail photo from the photos folder (only files uploaded for the rail: "/uploads/<file>"). */
async function removePhoto(url: string | null | undefined) {
  const key = url?.match(/^\/uploads\/([\w.-]+)$/)?.[1];
  if (key) await deleteFile(key).catch(() => undefined);
}

// ── Settings: on/off, where on the homepage, heading ───────────────────────

const settingsSchema = z.object({
  enabled: z.boolean(),
  placement: z.string().refine(isPlacement, "Choose where the rail goes."),
  heading: z.string().trim().max(80).optional().default(""),
});

export async function saveRailSettings(input: unknown): Promise<RailResult> {
  const user = await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the settings." };
  await ensureRailTables();
  const data = { enabled: parsed.data.enabled, placement: parsed.data.placement, heading: parsed.data.heading || null };
  await prisma.railSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
  await logAudit(user.id, "rail.settings", "RailSettings", "singleton", data);
  revalidateRail();
  return { ok: true, message: "Saved." };
}

// ── Items ──────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  productId: z.string().optional().default(""),
  collectionId: z.string().optional().default(""),
  word: z.string().trim().max(20, "Keep the word to 20 letters or fewer.").optional().default(""),
  frontImage: imageUrl,
  sideImage: imageUrl,
});

async function checkCollection(collectionId: string): Promise<string | null> {
  if (!collectionId) return null;
  const collection = await prisma.railCollection.findUnique({ where: { id: collectionId }, select: { id: true } });
  return collection ? collection.id : null;
}

async function checkProduct(productId: string): Promise<string | null> {
  if (!productId) return null;
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  return product ? product.id : null;
}

export async function createRailItem(input: unknown): Promise<RailResult> {
  const user = await requireStaff();
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;
  await ensureRailTables();
  const collectionId = await checkCollection(d.collectionId);
  const last = await prisma.railItem.findFirst({ where: { collectionId }, orderBy: { position: "desc" }, select: { position: true } });
  const item = await prisma.railItem.create({
    data: {
      productId: await checkProduct(d.productId),
      collectionId,
      word: d.word || null,
      frontImage: d.frontImage,
      sideImage: d.sideImage,
      position: (last?.position ?? 0) + 1,
    },
  });
  await logAudit(user.id, "rail.create", "RailItem", item.id, { productId: item.productId, collectionId });
  revalidateRail();
  return { ok: true, message: "Added to the rail.", id: item.id };
}

const updateSchema = z.object({
  productId: z.string().optional(),
  collectionId: z.string().optional(),
  word: z.string().trim().max(20, "Keep the word to 20 letters or fewer.").optional(),
  isActive: z.boolean().optional(),
  frontImage: imageUrl.optional(),
  sideImage: imageUrl.optional(),
});

export async function updateRailItem(id: string, input: unknown): Promise<RailResult> {
  const user = await requireStaff();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;
  await ensureRailTables();
  const existing = await prisma.railItem.findUnique({ where: { id } });
  if (!existing) return { ok: false, message: "This rail item no longer exists." };
  await prisma.railItem.update({
    where: { id },
    data: {
      productId: d.productId !== undefined ? await checkProduct(d.productId) : undefined,
      collectionId: d.collectionId !== undefined ? await checkCollection(d.collectionId) : undefined,
      word: d.word !== undefined ? d.word || null : undefined,
      isActive: d.isActive,
      frontImage: d.frontImage,
      sideImage: d.sideImage,
    },
  });
  // A replaced photo isn't used anywhere else
  if (d.frontImage && d.frontImage !== existing.frontImage) await removePhoto(existing.frontImage);
  if (d.sideImage && d.sideImage !== existing.sideImage) await removePhoto(existing.sideImage);
  await logAudit(user.id, "rail.update", "RailItem", id, d);
  revalidateRail();
  return { ok: true, message: "Saved." };
}

/** Moves an item one place left (-1) or right (+1) within its collection's rail. */
export async function moveRailItem(id: string, direction: -1 | 1): Promise<RailResult> {
  await requireStaff();
  await ensureRailTables();
  const item = await prisma.railItem.findUnique({ where: { id }, select: { collectionId: true } });
  if (!item) return { ok: true };
  const items = await prisma.railItem.findMany({
    where: { collectionId: item.collectionId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const from = items.findIndex((i) => i.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= items.length) return { ok: true };
  [items[from], items[to]] = [items[to], items[from]];
  await prisma.$transaction(items.map((item, position) => prisma.railItem.update({ where: { id: item.id }, data: { position } })));
  revalidateRail();
  return { ok: true };
}

export async function deleteRailItem(id: string): Promise<RailResult> {
  const user = await requireStaff();
  await ensureRailTables();
  const existing = await prisma.railItem.findUnique({ where: { id } });
  if (!existing) return { ok: true };
  await prisma.railItem.delete({ where: { id } });
  await removePhoto(existing.frontImage);
  await removePhoto(existing.sideImage);
  await logAudit(user.id, "rail.delete", "RailItem", id, { productId: existing.productId });
  revalidateRail();
  return { ok: true, message: "Removed from the rail." };
}

// ── Collections (the buttons above the rail) ──────────────────────────────

const collectionName = z.string().trim().min(2, "Enter a name.").max(60, "Keep the name to 60 letters or fewer.");

export async function createRailCollection(name: unknown): Promise<RailResult> {
  const user = await requireStaff();
  const parsed = collectionName.safeParse(name);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  await ensureRailTables();
  const last = await prisma.railCollection.findFirst({ orderBy: { position: "desc" }, select: { position: true } });
  const c = await prisma.railCollection.create({ data: { name: parsed.data, position: (last?.position ?? 0) + 1 } });
  await logAudit(user.id, "rail.collection.create", "RailCollection", c.id, { name: c.name });
  revalidateRail();
  return { ok: true, message: "Collection added.", id: c.id };
}

export async function updateRailCollection(id: string, input: { name?: unknown; isActive?: boolean }): Promise<RailResult> {
  const user = await requireStaff();
  const name = input.name !== undefined ? collectionName.safeParse(input.name) : null;
  if (name && !name.success) return { ok: false, message: name.error.issues[0]?.message };
  await ensureRailTables();
  await prisma.railCollection.update({
    where: { id },
    data: { name: name?.success ? name.data : undefined, isActive: typeof input.isActive === "boolean" ? input.isActive : undefined },
  });
  await logAudit(user.id, "rail.collection.update", "RailCollection", id, { name: name?.success ? name.data : undefined, isActive: input.isActive });
  revalidateRail();
  return { ok: true, message: "Saved." };
}

/** Moves a collection's button one place left (-1) or right (+1). */
export async function moveRailCollection(id: string, direction: -1 | 1): Promise<RailResult> {
  await requireStaff();
  await ensureRailTables();
  const list = await prisma.railCollection.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const from = list.findIndex((c) => c.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= list.length) return { ok: true };
  [list[from], list[to]] = [list[to], list[from]];
  await prisma.$transaction(list.map((c, position) => prisma.railCollection.update({ where: { id: c.id }, data: { position } })));
  revalidateRail();
  return { ok: true };
}

/** Deletes an empty collection (move or remove its garments first). */
export async function deleteRailCollection(id: string): Promise<RailResult> {
  const user = await requireStaff();
  await ensureRailTables();
  if ((await prisma.railItem.count({ where: { collectionId: id } })) > 0) {
    return { ok: false, message: "Move or remove this collection's garments first." };
  }
  await prisma.railCollection.delete({ where: { id } }).catch(() => undefined);
  await logAudit(user.id, "rail.collection.delete", "RailCollection", id);
  revalidateRail();
  return { ok: true, message: "Collection deleted." };
}
