import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CART_COOKIE } from "@/lib/cart";

/**
 * Merge a guest cart (cookie token) into the signed-in user's cart on login.
 * Quantities are summed and capped at available stock. Safe to call when there
 * is no guest cart.
 */
export async function mergeGuestCartIntoUser(userId: string): Promise<void> {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  if (!token) return;

  const guestCart = await prisma.cart.findUnique({ where: { token }, include: { items: true } });
  if (!guestCart || guestCart.items.length === 0) {
    if (guestCart) await prisma.cart.delete({ where: { id: guestCart.id } });
    jar.delete(CART_COOKIE);
    return;
  }

  const userCart =
    (await prisma.cart.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } })) ??
    (await prisma.cart.create({ data: { userId } }));

  for (const item of guestCart.items) {
    const variant = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
    if (!variant) continue;
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
    });
    const quantity = Math.min((existing?.quantity ?? 0) + item.quantity, variant.stock);
    if (quantity <= 0) continue;
    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
      update: { quantity },
      create: { cartId: userCart.id, variantId: item.variantId, quantity },
    });
  }

  await prisma.cart.delete({ where: { id: guestCart.id } });
  jar.delete(CART_COOKIE);
}
