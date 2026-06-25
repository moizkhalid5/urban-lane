import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const CART_COOKIE = "ul_cart";

export type CartLine = {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  title: string;
  brand: string | null;
  variantLabel: string | null;
  image: string | null;
  unitPriceCents: number;
  quantity: number;
  stock: number;
  lineTotalCents: number;
};

export type CartView = {
  id: string | null;
  lines: CartLine[];
  count: number;
  subtotalCents: number;
};

const EMPTY: CartView = { id: null, lines: [], count: 0, subtotalCents: 0 };

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      variant: {
        include: {
          product: {
            include: { brand: { select: { name: true } }, images: { take: 1, orderBy: { position: "asc" } } },
          },
        },
      },
    },
  },
} as const;

/** Locate the current cart (by logged-in user, else guest cookie token). Read-only. */
export async function getCart(): Promise<CartView> {
  const session = await auth();
  const token = (await cookies()).get(CART_COOKIE)?.value;

  const cart = session?.user?.id
    ? await prisma.cart.findFirst({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        include: cartInclude,
      })
    : token
      ? await prisma.cart.findUnique({ where: { token }, include: cartInclude })
      : null;

  if (!cart) return EMPTY;

  const lines: CartLine[] = cart.items.map((item) => {
    const v = item.variant;
    const p = v.product;
    const unit = v.priceCents ?? p.priceCents;
    return {
      id: item.id,
      variantId: v.id,
      productId: p.id,
      slug: p.slug,
      title: p.title,
      brand: p.brand?.name ?? null,
      variantLabel: v.label,
      image: v.image ?? p.images[0]?.url ?? null,
      unitPriceCents: unit,
      quantity: item.quantity,
      stock: v.stock,
      lineTotalCents: unit * item.quantity,
    };
  });

  return {
    id: cart.id,
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalCents: lines.reduce((s, l) => s + l.lineTotalCents, 0),
  };
}

export async function getCartCount(): Promise<number> {
  return (await getCart()).count;
}
