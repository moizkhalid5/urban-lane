import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/guards";

/**
 * Wishlist for everyone: signed-in customers keep it in the database; guests keep it in a cookie on their
 * device (no login needed to save a product). When a guest logs in, their saved products move to their
 * account (mergeGuestWishlistIntoUser, called on login like the guest cart).
 */
export const WISHLIST_COOKIE = "ul_wishlist";
const MAX_GUEST_ITEMS = 100;
const ID = /^[a-z0-9]{10,40}$/i;

/** Product ids in the guest cookie, newest first. */
export async function guestWishlistIds(): Promise<string[]> {
  const raw = (await cookies()).get(WISHLIST_COOKIE)?.value ?? "";
  return [...new Set(raw.split(".").filter((id) => ID.test(id)))].slice(0, MAX_GUEST_ITEMS);
}

/** Saves the guest list (only callable from a server action or route handler). */
export async function setGuestWishlistIds(ids: string[]): Promise<void> {
  const jar = await cookies();
  const list = [...new Set(ids)].filter((id) => ID.test(id)).slice(0, MAX_GUEST_ITEMS);
  if (list.length === 0) jar.delete(WISHLIST_COOKIE);
  else jar.set(WISHLIST_COOKIE, list.join("."), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

/** The current shopper's wishlist (product ids, newest first). */
export async function getWishlistIds(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return guestWishlistIds();
  const rows = await prisma.wishlistItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { productId: true } });
  return rows.map((r) => r.productId);
}

export async function getWishlistCount(): Promise<number> {
  try {
    const user = await getCurrentUser();
    return user ? await prisma.wishlistItem.count({ where: { userId: user.id } }) : (await guestWishlistIds()).length;
  } catch {
    return 0;
  }
}

export async function isWishlisted(productId: string): Promise<boolean> {
  return (await getWishlistIds()).includes(productId);
}

/** Moves a guest's saved products into their account on login, then clears the cookie. */
export async function mergeGuestWishlistIntoUser(userId: string): Promise<void> {
  const ids = await guestWishlistIds();
  if (ids.length === 0) return;
  const existing = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true } });
  await prisma.wishlistItem.createMany({ data: existing.map((p) => ({ userId, productId: p.id })), skipDuplicates: true });
  await setGuestWishlistIds([]);
}
