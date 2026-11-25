import "server-only";
import { randomBytes } from "crypto";
import { Prisma, type PaymentMethod, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/order-number";
import { departmentOf } from "@/lib/seo/copy";
import { MADE_UP_DOMAIN, NO_EMAIL_DOMAIN } from "@/lib/orders/placeholders";

/**
 * Orders and customers the admin adds by hand (Admin → Orders → Create order, Admin → Customers → Add
 * customer), and made-up sales (Admin → Orders → Made-up sales).
 *
 * - A created order is a real sale recorded after the fact (WhatsApp, Instagram, the shop, before the
 *   website...): it can be dated in the past, takes its pieces off the stock (unless unticked) and counts in
 *   the product's "sold" figure, like a checkout order. Nobody is emailed.
 * - Made-up sales only show in the admin's Dashboard and Analytics. They don't change stock, the "sold"
 *   figures or best-seller order on the shop, are never emailed or asked for reviews, and are removed in one
 *   click. They are told apart by their email address (lib/orders/placeholders.ts).
 */

/** Real orders only: leaves out made-up sales. */
export const NOT_MADE_UP: Prisma.OrderWhereInput = { NOT: { email: { endsWith: `@${MADE_UP_DOMAIN}` } } };
/** Made-up sales only. */
export const MADE_UP: Prisma.OrderWhereInput = { email: { endsWith: `@${MADE_UP_DOMAIN}` } };

/** "2026-11-24T18:30" typed in Pakistan time (UTC+5) → the moment it means. */
export function fromPakistanTime(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = "12", mi = "00"] = m;
  const utc = Date.UTC(+y, +mo - 1, +d, +h - 5, +mi);
  return Number.isNaN(utc) ? null : new Date(utc);
}

/** An address for a customer with no email (every customer and order needs one); never emailed. */
export function noEmailAddress(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 30) || "customer";
  return `${slug}.${randomBytes(3).toString("hex")}@${NO_EMAIL_DOMAIN}`;
}

type Tx = Prisma.TransactionClient | PrismaClient;

/** Creates the order with a fresh order number (tries again in the rare case the number is taken). */
export async function createWithOrderNumber(
  tx: Tx,
  data: Omit<Prisma.OrderUncheckedCreateInput, "orderNumber">,
): Promise<{ id: string; orderNumber: string }> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await tx.order.create({ data: { ...data, orderNumber: generateOrderNumber() }, select: { id: true, orderNumber: true } });
    } catch (err) {
      const taken = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!taken || attempt >= 4) throw err;
    }
  }
}

// ── made-up sales ─────────────────────────────────────────────────────────────

export type MadeUpScope = { beauty: boolean; soldOut: boolean };

type Candidate = {
  productId: string;
  variantId: string | null;
  title: string;
  variantLabel: string | null;
  sku: string | null;
  brand: string | null;
  image: string | null;
  priceCents: number;
};

/** Products made-up sales can be added to: make-up (Beauty) and/or sold-out products (no drafts). */
export async function madeUpCandidates(scope: MadeUpScope): Promise<{ beauty: Candidate[]; soldOut: Candidate[] }> {
  const rows = await prisma.product.findMany({
    where: { status: { in: ["ACTIVE", "ARCHIVED"] }, priceCents: { gt: 0 } },
    select: {
      id: true,
      title: true,
      gender: true,
      priceCents: true,
      sku: true,
      brand: { select: { name: true } },
      images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
      categories: { select: { category: { select: { slug: true } } } },
      variants: { select: { id: true, label: true, size: true, color: true, sku: true, priceCents: true, stock: true, isActive: true }, orderBy: { position: "asc" } },
    },
  });
  const beauty: Candidate[] = [];
  const soldOut: Candidate[] = [];
  for (const p of rows) {
    const isBeauty = departmentOf(p.gender, p.categories.map((c) => c.category.slug)) === "beauty";
    const stock = p.variants.filter((v) => v.isActive).reduce((s, v) => s + Math.max(0, v.stock), 0);
    const isSoldOut = stock === 0;
    if (!(scope.beauty && isBeauty) && !(scope.soldOut && isSoldOut)) continue;
    // each piece is one of the product's sizes/shades, picked at random when the order is made
    const variants = p.variants.length ? p.variants : [null];
    const v = variants[Math.floor(Math.random() * variants.length)];
    const c: Candidate = {
      productId: p.id,
      variantId: v?.id ?? null,
      title: p.title,
      variantLabel: v ? v.label ?? ([v.size, v.color].filter(Boolean).join(" / ") || null) : null,
      sku: v?.sku ?? p.sku ?? null,
      brand: p.brand?.name ?? null,
      image: p.images[0]?.url ?? null,
      priceCents: v?.priceCents ?? p.priceCents,
    };
    if (scope.beauty && isBeauty) beauty.push(c);
    else soldOut.push(c);
  }
  return { beauty, soldOut };
}

const FIRST = [
  "Ayesha", "Fatima", "Hina", "Sana", "Mahnoor", "Zainab", "Amna", "Iqra", "Maryam", "Areeba", "Saba", "Nimra", "Rabia", "Mehwish", "Kiran",
  "Ali", "Ahmed", "Hamza", "Usman", "Bilal", "Hassan", "Fahad", "Omar", "Saad", "Danish", "Imran", "Zeeshan", "Haris", "Taimoor", "Faisal",
];
const LAST = ["Khan", "Ahmed", "Malik", "Hussain", "Raza", "Butt", "Sheikh", "Qureshi", "Chaudhry", "Siddiqui", "Abbasi", "Mirza", "Javed", "Iqbal", "Shah"];
/** roughly where the shop's buyers are */
const CITIES: [string, number][] = [
  ["Lahore", 24], ["Karachi", 22], ["Islamabad", 14], ["Rawalpindi", 10], ["Faisalabad", 6], ["Multan", 5], ["Peshawar", 5],
  ["Sialkot", 3], ["Gujranwala", 3], ["Hyderabad", 2], ["Quetta", 2], ["Abbottabad", 2], ["Bahawalpur", 2],
];
const METHODS: [PaymentMethod, number][] = [["COD", 60], ["EASYPAISA", 25], ["JAZZCASH", 15]];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
function weighted<T>(list: [T, number][]): T {
  let r = Math.random() * list.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of list) if ((r -= w) < 0) return v;
  return list[0][0];
}
const between = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/**
 * Adds made-up sales: `min`–`max` pieces of each chosen product, grouped into orders of 1–3 products, at
 * random times (9am–11pm Pakistan time) between `from` and `to`. Paid and delivered, with the shop's
 * current prices and delivery charge.
 */
export async function addMadeUpSales(opts: {
  scope: MadeUpScope;
  from: Date;
  to: Date;
  min: number;
  max: number;
  shipping: { flatShippingCents: number; freeShippingThresholdCents: number | null };
  currency: string;
}): Promise<{ orders: number; pieces: number; totalCents: number; products: number }> {
  const { beauty, soldOut } = await madeUpCandidates(opts.scope);
  const products = [...beauty, ...soldOut];
  // shuffle, then deal the products into orders of 1–3
  for (let i = products.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [products[i], products[j]] = [products[j], products[i]];
  }
  const groups: Candidate[][] = [];
  for (let i = 0; i < products.length; ) {
    const n = weighted<number>([[1, 55], [2, 30], [3, 15]]);
    groups.push(products.slice(i, i + n));
    i += n;
  }

  const dayMs = 86_400_000;
  const firstDay = Math.floor((opts.from.getTime() + 5 * 3_600_000) / dayMs);
  const lastDay = Math.floor((opts.to.getTime() + 5 * 3_600_000) / dayMs);
  const now = Date.now();
  let orders = 0;
  let pieces = 0;
  let totalCents = 0;

  for (const group of groups) {
    const lines = group.map((c) => ({ c, qty: between(opts.min, opts.max) }));
    const subtotal = lines.reduce((s, l) => s + l.c.priceCents * l.qty, 0);
    const free = opts.shipping.freeShippingThresholdCents != null && subtotal >= opts.shipping.freeShippingThresholdCents;
    const shippingCents = free ? 0 : opts.shipping.flatShippingCents;
    // a time between 9am and 11pm Pakistan time on a day in the range, never in the future
    const day = between(firstDay, lastDay);
    let at = day * dayMs - 5 * 3_600_000 + between(9 * 60, 22 * 60 + 59) * 60_000 + between(0, 59) * 1000;
    if (at > now) at = now - between(5, 120) * 60_000;
    const first = pick(FIRST);
    const last = pick(LAST);
    const createdAt = new Date(at);

    await createWithOrderNumber(prisma, {
      email: `${first}.${last}.${randomBytes(3).toString("hex")}@${MADE_UP_DOMAIN}`.toLowerCase(),
      phone: null,
      firstName: first,
      lastName: last,
      shipLine1: "",
      shipCity: weighted(CITIES),
      shipPostalCode: "",
      shipCountry: "PK",
      currency: opts.currency,
      subtotalCents: subtotal,
      shippingCents,
      discountCents: 0,
      totalCents: subtotal + shippingCents,
      shippingMethod: "standard",
      paymentMethod: weighted(METHODS),
      paymentStatus: "PAID",
      fulfillmentStatus: "DELIVERED",
      adminNote: "Made-up sale (Admin → Orders → Made-up sales). Not a real order.",
      createdAt,
      updatedAt: new Date(Math.min(now, at + between(2, 6) * dayMs)),
      items: {
        create: lines.map((l) => ({
          productId: l.c.productId,
          variantId: l.c.variantId,
          productTitle: l.c.title,
          variantLabel: l.c.variantLabel,
          sku: l.c.sku,
          brandName: l.c.brand,
          image: l.c.image,
          unitPriceCents: l.c.priceCents,
          quantity: l.qty,
        })),
      },
    });
    orders++;
    pieces += lines.reduce((s, l) => s + l.qty, 0);
    totalCents += subtotal + shippingCents;
  }
  return { orders, pieces, totalCents, products: products.length };
}

/** How many made-up sales there are now. */
export async function madeUpSummary() {
  const [agg, pieces, first, last] = await Promise.all([
    prisma.order.aggregate({ where: MADE_UP, _count: { _all: true }, _sum: { totalCents: true } }),
    prisma.orderItem.aggregate({ where: { order: MADE_UP }, _sum: { quantity: true } }),
    prisma.order.findFirst({ where: MADE_UP, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.order.findFirst({ where: MADE_UP, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  return {
    orders: agg._count._all,
    totalCents: agg._sum.totalCents ?? 0,
    pieces: pieces._sum.quantity ?? 0,
    from: first?.createdAt ?? null,
    to: last?.createdAt ?? null,
  };
}
