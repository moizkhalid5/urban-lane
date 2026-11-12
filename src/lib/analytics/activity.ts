import type { FulfillmentStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Admin → Analytics: what happened lately in the shop (newest first), and the latest orders with where they
 * are now. Not tied to the date range: these are "what's going on right now" panels.
 */
export type ActivityKind = "order" | "customer" | "review" | "product";
export type Activity = {
  kind: ActivityKind;
  at: Date;
  title: string;
  detail: string;
  href: string;
};

export async function recentActivity(limit = 7): Promise<Activity[]> {
  const [orders, customers, reviews, products] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        orderNumber: true,
        firstName: true,
        shipCity: true,
        totalCents: true,
        createdAt: true,
        items: { select: { quantity: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.review.findMany({
      where: { isSample: false },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        authorName: true,
        rating: true,
        createdAt: true,
        product: { select: { title: true } },
      },
    }),
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, title: true, createdAt: true },
    }),
  ]);

  const items = (o: (typeof orders)[number]) =>
    o.items.reduce((n, i) => n + i.quantity, 0);
  return [
    ...orders.map((o) => ({
      kind: "order" as const,
      at: o.createdAt,
      title: `Order ${o.orderNumber}`,
      detail: `${o.firstName}${o.shipCity ? ` from ${o.shipCity.trim()}` : ""} · ${items(o)} ${items(o) === 1 ? "item" : "items"}`,
      href: `/admin/orders/${o.orderNumber}`,
    })),
    ...customers.map((c) => ({
      kind: "customer" as const,
      at: c.createdAt,
      title: "New customer account",
      detail: c.name ?? "A new shopper",
      href: `/admin/customers/${c.id}`,
    })),
    ...reviews.map((r) => ({
      kind: "review" as const,
      at: r.createdAt,
      title: `${"★".repeat(Math.max(0, Math.min(5, r.rating)))} review`,
      detail: `${r.authorName}${r.product ? ` on ${r.product.title}` : ""}`,
      href: `/admin/reviews/${r.id}`,
    })),
    ...products.map((p) => ({
      kind: "product" as const,
      at: p.createdAt,
      title: "Product added",
      detail: p.title,
      href: `/admin/products/${p.id}`,
    })),
  ]
    .sort((a, b) => +b.at - +a.at)
    .slice(0, limit);
}

export type RecentOrder = {
  orderNumber: string;
  customer: string;
  city: string;
  totalCents: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  createdAt: Date;
};

export async function recentOrders(limit = 6): Promise<RecentOrder[]> {
  const rows = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      orderNumber: true,
      firstName: true,
      lastName: true,
      shipCity: true,
      totalCents: true,
      paymentMethod: true,
      paymentStatus: true,
      fulfillmentStatus: true,
      createdAt: true,
    },
  });
  return rows.map((o) => ({
    ...o,
    customer: `${o.firstName} ${o.lastName}`.trim(),
    city: o.shipCity?.trim() ?? "",
  }));
}
