"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/guards";
import { addressSchema } from "@/lib/validation";
import { guestWishlistIds, setGuestWishlistIds } from "@/lib/wishlist";

export type ActionResult = { ok: boolean; message?: string };

function parseAddress(formData: FormData) {
  return addressSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone") || "",
    line1: formData.get("line1"),
    line2: formData.get("line2") || "",
    city: formData.get("city"),
    state: formData.get("state") || "",
    postalCode: formData.get("postalCode"),
    country: formData.get("country") || "PK",
    type: (formData.get("type") as string) || "SHIPPING",
    isDefault: formData.get("isDefault") === "on",
  });
}

export async function saveAddress(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please log in." };

  const parsed = parseAddress(formData);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the address." };
  const data = parsed.data;
  const id = formData.get("id") as string | null;

  // Ensure only one default per user.
  if (data.isDefault) {
    await prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  }

  const payload = {
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone || null,
    line1: data.line1,
    line2: data.line2 || null,
    city: data.city,
    state: data.state || null,
    postalCode: data.postalCode,
    country: data.country,
    type: data.type,
    isDefault: data.isDefault,
  };

  if (id) {
    // Verify ownership before updating.
    const existing = await prisma.address.findFirst({ where: { id, userId: user.id } });
    if (!existing) return { ok: false, message: "Address not found." };
    await prisma.address.update({ where: { id }, data: payload });
  } else {
    await prisma.address.create({ data: { ...payload, userId: user.id } });
  }

  revalidatePath("/account/addresses");
  return { ok: true, message: "Address saved." };
}

export async function deleteAddress(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  await prisma.address.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/account/addresses");
  return { ok: true };
}

/** Saves or removes a product. Works without logging in: guests' wishlists are kept on their device (lib/wishlist). */
export async function toggleWishlist(productId: string): Promise<{ ok: boolean; wishlisted: boolean }> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return { ok: false, wishlisted: false };
  const user = await getCurrentUser();
  if (!user) {
    const ids = await guestWishlistIds();
    const wishlisted = !ids.includes(productId);
    await setGuestWishlistIds(wishlisted ? [productId, ...ids] : ids.filter((id) => id !== productId));
    revalidatePath("/wishlist");
    return { ok: true, wishlisted };
  }

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/wishlist");
    return { ok: true, wishlisted: false };
  }

  await prisma.wishlistItem.create({ data: { userId: user.id, productId } });
  revalidatePath("/wishlist");
  return { ok: true, wishlisted: true };
}
