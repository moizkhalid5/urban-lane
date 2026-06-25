"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { CART_COOKIE } from "@/lib/cart";
import { cartAddSchema, cartUpdateSchema } from "@/lib/validation";

export type CartActionResult = { ok: boolean; message?: string; count?: number };

/** Find or create the active cart for the current user/guest, returning its id. */
async function getOrCreateCartId(): Promise<string> {
  const session = await auth();
  const jar = await cookies();

  if (session?.user?.id) {
    const existing = await prisma.cart.findFirst({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) return existing.id;
    const created = await prisma.cart.create({ data: { userId: session.user.id } });
    return created.id;
  }

  const token = jar.get(CART_COOKIE)?.value;
  if (token) {
    const existing = await prisma.cart.findUnique({ where: { token } });
    if (existing) return existing.id;
  }
  const newToken = randomBytes(24).toString("hex");
  const created = await prisma.cart.create({ data: { token: newToken } });
  jar.set(CART_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return created.id;
}

async function countFor(cartId: string): Promise<number> {
  const agg = await prisma.cartItem.aggregate({ where: { cartId }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}

export async function addToCart(input: { variantId: string; quantity?: number }): Promise<CartActionResult> {
  const parsed = cartAddSchema.safeParse({ variantId: input.variantId, quantity: input.quantity ?? 1 });
  if (!parsed.success) return { ok: false, message: "Invalid item." };

  const variant = await prisma.productVariant.findUnique({
    where: { id: parsed.data.variantId },
    include: { product: { select: { status: true } } },
  });
  if (!variant || !variant.isActive || variant.product.status !== "ACTIVE") {
    return { ok: false, message: "This item is unavailable." };
  }
  if (variant.stock <= 0) return { ok: false, message: "Out of stock." };

  const cartId = await getOrCreateCartId();
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId: variant.id } },
  });

  const desired = (existing?.quantity ?? 0) + parsed.data.quantity;
  const quantity = Math.min(desired, variant.stock); // never exceed available stock

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId: variant.id } },
    update: { quantity },
    create: { cartId, variantId: variant.id, quantity },
  });

  revalidatePath("/cart");
  const count = await countFor(cartId);
  const capped = quantity < desired;
  return {
    ok: true,
    count,
    message: capped ? `Only ${variant.stock} in stock — cart updated to the maximum.` : "Added to bag.",
  };
}

export async function updateCartItem(input: { itemId: string; quantity: number }): Promise<CartActionResult> {
  const parsed = cartUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid update." };

  const item = await prisma.cartItem.findUnique({
    where: { id: parsed.data.itemId },
    include: { variant: true },
  });
  if (!item) return { ok: false, message: "Item not found." };

  if (parsed.data.quantity === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    const quantity = Math.min(parsed.data.quantity, item.variant.stock);
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  }

  revalidatePath("/cart");
  const count = await countFor(item.cartId);
  return { ok: true, count };
}

export async function removeCartItem(itemId: string): Promise<CartActionResult> {
  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false };
  await prisma.cartItem.delete({ where: { id: itemId } });
  revalidatePath("/cart");
  return { ok: true, count: await countFor(item.cartId) };
}
