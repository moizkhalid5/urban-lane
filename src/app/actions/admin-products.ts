"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/guards";
import { productInputSchema } from "@/lib/validation";
import { uniqueProductSlug } from "@/lib/unique-slug";
import { logAudit } from "@/lib/audit";

export type ProductActionResult = { ok: boolean; message?: string; id?: string; slug?: string };

function emptyToNull<T>(v: T | "" | null | undefined): T | null {
  return v === "" || v === undefined || v === null ? null : v;
}

export async function saveProduct(input: unknown, id?: string): Promise<ProductActionResult> {
  const user = await requireStaff();

  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the product details." };
  }
  const d = parsed.data;
  const slug = await uniqueProductSlug(d.slug || d.title, id);

  const scalar = {
    title: d.title,
    slug,
    description: emptyToNull(d.description),
    details: emptyToNull(d.details),
    material: emptyToNull(d.material),
    condition: emptyToNull(d.condition),
    status: d.status,
    brandId: emptyToNull(d.brandId),
    gender: emptyToNull(d.gender),
    productType: emptyToNull(d.productType),
    priceCents: d.priceCents,
    compareAtCents: d.compareAtCents ?? null,
    costCents: d.costCents ?? null,
    sku: emptyToNull(d.sku),
    barcode: emptyToNull(d.barcode),
    lowStockThreshold: d.lowStockThreshold,
    trackInventory: d.trackInventory,
    isFeatured: d.isFeatured,
    isOutlet: d.isOutlet,
    tags: d.tags,
    seoTitle: emptyToNull(d.seoTitle),
    seoDescription: emptyToNull(d.seoDescription),
    publishedAt: d.status === "ACTIVE" ? new Date() : null,
  };

  const variantData = d.variants.map((v, i) => ({
    label: emptyToNull(v.label) ?? ([v.size, v.color].filter(Boolean).join(" / ") || null),
    size: emptyToNull(v.size),
    color: emptyToNull(v.color),
    colorHex: emptyToNull(v.colorHex),
    sku: emptyToNull(v.sku),
    priceCents: v.priceCents ?? null,
    stock: v.stock,
    image: emptyToNull(v.image),
    position: i,
  }));

  // Always ensure at least one variant so every product is purchasable.
  if (variantData.length === 0) {
    variantData.push({ label: null, size: null, color: null, colorHex: null, sku: null, priceCents: null, stock: 0, image: null, position: 0 });
  }

  try {
    if (!id) {
      const created = await prisma.product.create({
        data: {
          ...scalar,
          categories: { create: d.categoryIds.map((categoryId) => ({ categoryId })) },
          images: { create: d.images.map((img, i) => ({ url: img.url, alt: img.alt ?? d.title, position: i })) },
          variants: { create: variantData },
        },
      });
      await logAudit(user.id, "product.create", "Product", created.id, { title: d.title });
      revalidatePath("/admin/products");
      revalidateTag("nav"); // the menu hides empty categories
      return { ok: true, id: created.id, slug: created.slug };
    }

    // Update: replace categories + images; upsert variants (keep ids referenced by orders).
    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: scalar });

      await tx.productCategory.deleteMany({ where: { productId: id } });
      if (d.categoryIds.length) {
        await tx.productCategory.createMany({
          data: d.categoryIds.map((categoryId) => ({ productId: id, categoryId })),
          skipDuplicates: true,
        });
      }

      await tx.productImage.deleteMany({ where: { productId: id } });
      if (d.images.length) {
        await tx.productImage.createMany({
          data: d.images.map((img, i) => ({ productId: id, url: img.url, alt: img.alt ?? d.title, position: i })),
        });
      }

      const incomingIds = d.variants.map((v) => v.id).filter(Boolean) as string[];
      await tx.productVariant.deleteMany({ where: { productId: id, id: { notIn: incomingIds.length ? incomingIds : ["__none__"] } } });
      for (let i = 0; i < d.variants.length; i++) {
        const v = d.variants[i];
        const data = variantData[i];
        if (v.id) {
          await tx.productVariant.update({ where: { id: v.id }, data });
        } else {
          await tx.productVariant.create({ data: { ...data, productId: id } });
        }
      }
    });
    await logAudit(user.id, "product.update", "Product", id, { title: d.title });
    revalidatePath("/admin/products");
    revalidateTag("nav");
    revalidatePath(`/products/${slug}`);
    return { ok: true, id, slug };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save product." };
  }
}

export async function setProductStatus(id: string, status: "DRAFT" | "ACTIVE" | "ARCHIVED"): Promise<ProductActionResult> {
  const user = await requireStaff();
  await prisma.product.update({
    where: { id },
    data: { status, publishedAt: status === "ACTIVE" ? new Date() : undefined },
  });
  await logAudit(user.id, "product.status", "Product", id, { status });
  revalidatePath("/admin/products");
  revalidateTag("nav");
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ProductActionResult> {
  const user = await requireStaff();
  // Hard delete is allowed; order snapshots survive (OrderItem fields are denormalized).
  await prisma.product.delete({ where: { id } });
  await logAudit(user.id, "product.delete", "Product", id);
  revalidatePath("/admin/products");
  revalidateTag("nav");
  return { ok: true };
}

/** Quick stock set for a single variant (used by inventory + product editor). */
export async function setVariantStock(variantId: string, stock: number): Promise<ProductActionResult> {
  const user = await requireStaff();
  if (!Number.isInteger(stock) || stock < 0) return { ok: false, message: "Invalid stock value." };
  await prisma.productVariant.update({ where: { id: variantId }, data: { stock } });
  await logAudit(user.id, "inventory.adjust", "ProductVariant", variantId, { stock });
  revalidatePath("/admin/inventory");
  return { ok: true };
}
