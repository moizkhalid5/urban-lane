"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/guards";
import { categoryInputSchema, brandInputSchema } from "@/lib/validation";
import { childSlug, slugify } from "@/lib/slug";
import { logAudit } from "@/lib/audit";

export type CatResult = { ok: boolean; message?: string };

async function uniqueCategorySlug(base: string, excludeId?: string): Promise<string> {
  const root = base || "category";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

export async function saveCategory(input: unknown, id?: string): Promise<CatResult> {
  const user = await requireStaff();
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid category." };
  const d = parsed.data;

  const parent = d.parentId ? await prisma.category.findUnique({ where: { id: d.parentId } }) : null;
  const level = parent ? parent.level + 1 : 0;

  const data = {
    name: d.name,
    description: d.description || null,
    parentId: d.parentId || null,
    level,
    image: d.image || null,
    position: d.position,
    isActive: d.isActive,
    showInNav: d.showInNav,
    seoTitle: d.seoTitle || null,
    seoDescription: d.seoDescription || null,
  };

  if (!id) {
    const slug = await uniqueCategorySlug(d.slug ? slugify(d.slug) : childSlug(parent?.slug ?? null, d.name));
    await prisma.category.create({ data: { ...data, slug } });
    await logAudit(user.id, "category.create", "Category", undefined, { name: d.name });
  } else {
    // Keep slug stable unless an explicit slug is provided.
    const slug = d.slug ? await uniqueCategorySlug(slugify(d.slug), id) : undefined;
    await prisma.category.update({ where: { id }, data: { ...data, ...(slug ? { slug } : {}) } });
    await logAudit(user.id, "category.update", "Category", id, { name: d.name });
  }

  revalidateTag("nav");
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<CatResult> {
  const user = await requireStaff();
  const childCount = await prisma.category.count({ where: { parentId: id } });
  if (childCount > 0) return { ok: false, message: "Remove or reassign sub-categories first." };
  await prisma.category.delete({ where: { id } });
  await logAudit(user.id, "category.delete", "Category", id);
  revalidateTag("nav");
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function saveBrand(input: unknown, id?: string): Promise<CatResult> {
  const user = await requireStaff();
  const parsed = brandInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid brand." };
  const d = parsed.data;
  const slug = d.slug ? slugify(d.slug) : slugify(d.name);

  const data = {
    name: d.name,
    slug,
    logo: d.logo || null,
    banner: d.banner || null,
    description: d.description || null,
    isFeatured: d.isFeatured,
    position: d.position,
  };

  try {
    if (!id) await prisma.brand.create({ data });
    else await prisma.brand.update({ where: { id }, data });
  } catch {
    return { ok: false, message: "A brand with this name or slug already exists." };
  }
  await logAudit(user.id, id ? "brand.update" : "brand.create", "Brand", id, { name: d.name });
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function deleteBrand(id: string): Promise<CatResult> {
  const user = await requireStaff();
  await prisma.brand.delete({ where: { id } });
  await logAudit(user.id, "brand.delete", "Brand", id);
  revalidatePath("/admin/categories");
  return { ok: true };
}
