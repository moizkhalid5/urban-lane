import type { FulfillmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { periodBounds, shopDate, type Period, type ReportRange } from "@/lib/analytics/ranges";

/**
 * Admin → Analytics, from the shop's own orders: the figures that are always exact (Google Analytics misses
 * shoppers who block it). Cancelled, returned, refunded and failed orders don't count.
 * Amounts are in paisa, the shop's base currency.
 */
const COUNTED: Prisma.OrderWhereInput = {
  fulfillmentStatus: { notIn: ["CANCELLED", "RETURNED"] },
  paymentStatus: { notIn: ["FAILED", "REFUNDED"] },
};

export type StoreTotals = {
  salesCents: number;
  orders: number;
  aovCents: number;
  customers: number;
  returningCustomers: number;
  returningRate: number | null;
};
export type Breakdown = { grossCents: number; discountCents: number; shippingCents: number; taxCents: number; totalCents: number; items: number };
export type Share = { name: string; cents: number; units: number };

export type StoreReport = {
  current: StoreTotals;
  previous: StoreTotals;
  /** per day, current and previous period, by position in the period (previousDate is null past its end) */
  byDay: { date: string; previousDate: string | null; cents: number; previousCents: number; orders: number; previousOrders: number }[];
  breakdown: Breakdown;
  previousBreakdown: Breakdown;
  byPayment: { method: string; orders: number; cents: number }[];
  topProducts: { productId: string | null; title: string; units: number; cents: number; image: string | null }[];
  byCategory: Share[];
  byCity: { name: string; cents: number; orders: number }[];
  /** orders placed in the period, by where they are now */
  fulfilment: { status: FulfillmentStatus; orders: number }[];
  /** orders in the period by weekday (0 = Monday) and hour, Pakistan time */
  byHour: number[][];
};

type Row = { createdAt: Date; totalCents: number; email: string };

async function totals(p: Period): Promise<StoreTotals & { rows: Row[] }> {
  const where = { ...COUNTED, createdAt: periodBounds(p) };
  const rows = await prisma.order.findMany({ where, select: { createdAt: true, totalCents: true, email: true } });
  const salesCents = rows.reduce((s, o) => s + o.totalCents, 0);
  const emails = [...new Set(rows.map((o) => o.email.toLowerCase()))];
  // Returning: customers in this period who had already ordered before it, or ordered more than once in it.
  let returning = 0;
  if (emails.length) {
    const before = await prisma.order.findMany({
      where: { ...COUNTED, createdAt: { lt: periodBounds(p).gte }, email: { in: emails } },
      select: { email: true },
      distinct: ["email"],
    });
    const earlier = new Set(before.map((o) => o.email.toLowerCase()));
    const count = new Map<string, number>();
    for (const o of rows) count.set(o.email.toLowerCase(), (count.get(o.email.toLowerCase()) ?? 0) + 1);
    returning = emails.filter((e) => earlier.has(e) || (count.get(e) ?? 0) > 1).length;
  }
  return {
    salesCents,
    orders: rows.length,
    aovCents: rows.length ? Math.round(salesCents / rows.length) : 0,
    customers: emails.length,
    returningCustomers: returning,
    returningRate: emails.length ? returning / emails.length : null,
    rows,
  };
}

async function breakdown(p: Period): Promise<Breakdown> {
  const where = { ...COUNTED, createdAt: periodBounds(p) };
  const [sums, items] = await Promise.all([
    prisma.order.aggregate({ where, _sum: { subtotalCents: true, discountCents: true, shippingCents: true, taxCents: true, totalCents: true } }),
    prisma.orderItem.aggregate({ where: { order: where }, _sum: { quantity: true } }),
  ]);
  return {
    grossCents: sums._sum.subtotalCents ?? 0,
    discountCents: sums._sum.discountCents ?? 0,
    shippingCents: sums._sum.shippingCents ?? 0,
    taxCents: sums._sum.taxCents ?? 0,
    totalCents: sums._sum.totalCents ?? 0,
    items: items._sum.quantity ?? 0,
  };
}

/**
 * The category a product sells under: its most specific active category, with the top-level group in front
 * when that helps ("Women · Dresses"). Products without one fall back to their department.
 */
async function categoryNamer() {
  const cats = await prisma.category.findMany({ where: { isVirtual: false }, select: { id: true, name: true, parentId: true, level: true } });
  const byId = new Map(cats.map((c) => [c.id, c]));
  const root = (id: string) => {
    let c = byId.get(id);
    for (let i = 0; c?.parentId && i < 6; i++) c = byId.get(c.parentId) ?? c;
    return c;
  };
  return (categoryIds: string[], gender: string | null) => {
    const own = categoryIds.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
    if (!own.length) return gender ? gender[0].toUpperCase() + gender.slice(1) : "Uncategorised";
    const deepest = own.reduce((a, b) => (b.level > a.level ? b : a));
    const top = root(deepest.id);
    return top && top.id !== deepest.id ? `${top.name} · ${deepest.name}` : deepest.name;
  };
}

const titleCase = (s: string) => s.trim().toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase());

export async function storeReport(range: ReportRange): Promise<StoreReport> {
  const where = { ...COUNTED, createdAt: periodBounds(range.current) };
  const [cur, prev, sums, prevSums, byPayment, items, cities, fulfilment, nameCategory] = await Promise.all([
    totals(range.current),
    totals(range.previous),
    breakdown(range.current),
    breakdown(range.previous),
    prisma.order.groupBy({ by: ["paymentMethod"], where, _count: { _all: true }, _sum: { totalCents: true } }),
    prisma.orderItem.findMany({
      where: { order: where },
      select: {
        productId: true,
        productTitle: true,
        quantity: true,
        unitPriceCents: true,
        image: true,
        product: {
          select: {
            gender: true,
            categories: { select: { categoryId: true } },
            images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
          },
        },
      },
    }),
    prisma.order.findMany({ where, select: { shipCity: true, totalCents: true } }),
    prisma.order.groupBy({ by: ["fulfillmentStatus"], where: { createdAt: periodBounds(range.current) }, _count: { _all: true } }),
    categoryNamer(),
  ]);

  const perDay = (rows: Row[]) => {
    const m = new Map<string, { cents: number; orders: number }>();
    for (const o of rows) {
      const d = shopDate(o.createdAt);
      const v = m.get(d) ?? { cents: 0, orders: 0 };
      m.set(d, { cents: v.cents + o.totalCents, orders: v.orders + 1 });
    }
    return m;
  };
  const curDays = perDay(cur.rows);
  const prevDays = perDay(prev.rows);
  const byDay = range.current.days.map((date, i) => {
    const previousDate = range.previous.days[i] ?? null;
    const p = previousDate ? prevDays.get(previousDate) : undefined;
    return {
      date,
      previousDate,
      cents: curDays.get(date)?.cents ?? 0,
      orders: curDays.get(date)?.orders ?? 0,
      previousCents: p?.cents ?? 0,
      previousOrders: p?.orders ?? 0,
    };
  });

  const products = new Map<string, StoreReport["topProducts"][number]>();
  const categories = new Map<string, Share>();
  for (const it of items) {
    const cents = it.quantity * it.unitPriceCents;
    const k = it.productId ?? it.productTitle;
    const v = products.get(k) ?? { productId: it.productId, title: it.productTitle, units: 0, cents: 0, image: null as string | null };
    // the product's current main photo; the one saved with the order if the product is gone
    v.image ??= it.product?.images[0]?.url ?? it.image;
    v.units += it.quantity;
    v.cents += cents;
    products.set(k, v);

    const name = it.product ? nameCategory(it.product.categories.map((c) => c.categoryId), it.product.gender) : "Removed products";
    const c = categories.get(name) ?? { name, cents: 0, units: 0 };
    c.cents += cents;
    c.units += it.quantity;
    categories.set(name, c);
  }

  const cityTotals = new Map<string, { name: string; cents: number; orders: number }>();
  for (const o of cities) {
    const name = o.shipCity?.trim() ? titleCase(o.shipCity) : "Not given";
    const v = cityTotals.get(name) ?? { name, cents: 0, orders: 0 };
    v.cents += o.totalCents;
    v.orders += 1;
    cityTotals.set(name, v);
  }

  // weekday × hour: Pakistan is UTC+5 all year
  const byHour = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const o of cur.rows) {
    const t = new Date(o.createdAt.getTime() + 5 * 3600_000);
    byHour[(t.getUTCDay() + 6) % 7][t.getUTCHours()] += 1;
  }

  const ORDER: FulfillmentStatus[] = ["UNFULFILLED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];
  const strip = ({ rows: _rows, ...t }: Awaited<ReturnType<typeof totals>>): StoreTotals => t;
  return {
    current: strip(cur),
    previous: strip(prev),
    byDay,
    breakdown: sums,
    previousBreakdown: prevSums,
    byPayment: byPayment
      .map((r) => ({ method: r.paymentMethod, orders: r._count._all, cents: r._sum.totalCents ?? 0 }))
      .sort((a, b) => b.cents - a.cents),
    topProducts: [...products.values()].sort((a, b) => b.cents - a.cents).slice(0, 10),
    byCategory: [...categories.values()].sort((a, b) => b.cents - a.cents).slice(0, 10),
    byCity: [...cityTotals.values()].sort((a, b) => b.cents - a.cents).slice(0, 10),
    fulfilment: ORDER.map((status) => ({ status, orders: fulfilment.find((f) => f.fulfillmentStatus === status)?._count._all ?? 0 })),
    byHour,
  };
}
