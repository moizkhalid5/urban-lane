"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, requireAdmin } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { getSiteSettings } from "@/lib/settings";
import { addMadeUpSales, createWithOrderNumber, fromPakistanTime, MADE_UP, noEmailAddress } from "@/lib/orders/admin-orders";

/**
 * Admin → Orders → Create order, Admin → Customers → Add customer, Admin → Orders → Made-up sales.
 * See lib/orders/admin-orders.ts.
 */

export type ActionResult = { ok: boolean; message?: string; id?: string; orderNumber?: string };

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/analytics");
}

// ── look-ups for the Create order form ───────────────────────────────────────

export type ProductOption = {
  productId: string;
  title: string;
  brand: string | null;
  image: string | null;
  status: string;
  variants: { id: string; label: string; stock: number; priceCents: number }[];
};

/** Products matching a title, brand or SKU, with their sizes, stock and price. */
export async function findProductsForOrder(q: string): Promise<ProductOption[]> {
  await requireStaff();
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await prisma.product.findMany({
    where: {
      status: { not: "DRAFT" },
      OR: [
        { title: { contains: term } },
        { sku: { contains: term } },
        { brand: { name: { contains: term } } },
        { variants: { some: { sku: { contains: term } } } },
      ],
    },
    orderBy: [{ status: "asc" }, { title: "asc" }],
    take: 12,
    select: {
      id: true,
      title: true,
      status: true,
      priceCents: true,
      brand: { select: { name: true } },
      images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
      variants: { select: { id: true, label: true, size: true, color: true, stock: true, priceCents: true }, orderBy: { position: "asc" } },
    },
  });
  return rows.map((p) => ({
    productId: p.id,
    title: p.title,
    brand: p.brand?.name ?? null,
    image: p.images[0]?.url ?? null,
    status: p.status,
    variants: p.variants.map((v) => ({
      id: v.id,
      label: v.label ?? ([v.size, v.color].filter(Boolean).join(" / ") || "One size"),
      stock: v.stock,
      priceCents: v.priceCents ?? p.priceCents,
    })),
  }));
}

export type CustomerOption = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: { line1: string; line2: string | null; city: string; postalCode: string } | null;
};

/** Customers matching a name, email or phone number. */
export async function findCustomers(q: string): Promise<CustomerOption[]> {
  await requireStaff();
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      OR: [{ name: { contains: term } }, { email: { contains: term } }, { profile: { phone: { contains: term } } }],
    },
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      profile: { select: { phone: true } },
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }], take: 1 },
    },
  });
  return rows.map((u) => {
    const a = u.addresses[0];
    return {
      id: u.id,
      name: u.name ?? "",
      email: u.email,
      phone: u.profile?.phone ?? a?.phone ?? null,
      address: a ? { line1: a.line1, line2: a.line2, city: a.city, postalCode: a.postalCode } : null,
    };
  });
}

// ── add a customer ───────────────────────────────────────────────────────────

const text = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const customerSchema = z.object({
  firstName: z.string().trim().min(1, "Enter the customer's first name.").max(80),
  lastName: text(80),
  email: z.string().trim().email("That email doesn't look right.").max(200).optional().or(z.literal("")),
  phone: text(40),
  line1: text(200),
  line2: text(200),
  city: text(100),
  postalCode: text(20),
  acceptsMarketing: z.boolean().optional(),
});
type CustomerInput = z.infer<typeof customerSchema>;

/** Creates the customer (no password: they can set one with "Forgot password" if they have an email). */
async function saveCustomer(d: CustomerInput) {
  const name = [d.firstName, d.lastName].filter(Boolean).join(" ");
  const email = d.email ? d.email.toLowerCase() : noEmailAddress(name);
  if (d.email && (await prisma.user.findUnique({ where: { email } }))) {
    throw new Error("A customer with that email already exists. Search for them instead.");
  }
  return prisma.user.create({
    data: {
      email,
      name,
      role: "CUSTOMER",
      profile: { create: { phone: d.phone || null, acceptsMarketing: !!d.email && !!d.acceptsMarketing } },
      addresses:
        d.line1 && d.city
          ? {
              create: {
                isDefault: true,
                firstName: d.firstName,
                lastName: d.lastName || "",
                phone: d.phone || null,
                line1: d.line1,
                line2: d.line2 || null,
                city: d.city,
                postalCode: d.postalCode || "",
                country: "PK",
              },
            }
          : undefined,
    },
    select: { id: true, email: true, name: true },
  });
}

export async function createCustomer(input: unknown): Promise<ActionResult> {
  const user = await requireStaff();
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the details." };
  try {
    const c = await saveCustomer(parsed.data);
    await logAudit(user.id, "customer.create", "User", c.id);
    revalidateAdmin();
    return { ok: true, id: c.id, message: "Customer added." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't add the customer." };
  }
}

// ── create an order ──────────────────────────────────────────────────────────

const orderSchema = z.object({
  date: z.string().min(1, "Choose the order date."),
  channel: z.string().trim().max(40),
  customerId: z.string().optional().or(z.literal("")),
  newCustomer: customerSchema.optional(),
  saveCustomer: z.boolean().optional(),
  address: z.object({ line1: text(200), line2: text(200), city: text(100), postalCode: text(20) }),
  lines: z
    .array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(10_000), unitPrice: z.number().min(0).max(100_000_000) }))
    .min(1, "Add at least one product."),
  shipping: z.number().min(0).max(10_000_000),
  discount: z.number().min(0).max(100_000_000),
  paymentMethod: z.enum(["COD", "EASYPAISA", "JAZZCASH", "BANK_TRANSFER", "CARD"]),
  paymentStatus: z.enum(["PAID", "PENDING"]),
  fulfillmentStatus: z.enum(["DELIVERED", "SHIPPED", "PROCESSING", "UNFULFILLED"]),
  takeStock: z.boolean(),
  note: text(1500),
});

/**
 * Records a sale as an order, dated when it happened. Nobody is emailed. The pieces come off the stock when
 * `takeStock` is ticked, and count in each product's "sold" figure (it's a real sale).
 */
export async function createManualOrder(input: unknown): Promise<ActionResult> {
  const user = await requireStaff();
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the order." };
  const d = parsed.data;

  const createdAt = fromPakistanTime(d.date);
  if (!createdAt) return { ok: false, message: "Choose the order date." };
  if (createdAt.getTime() > Date.now() + 5 * 60_000) return { ok: false, message: "The order date can't be in the future." };
  if (createdAt.getUTCFullYear() < 2015) return { ok: false, message: "Check the order date." };

  // who bought it
  let customer: { id: string | null; email: string; firstName: string; lastName: string; phone: string | null };
  if (d.customerId) {
    const u = await prisma.user.findUnique({ where: { id: d.customerId }, include: { profile: true } });
    if (!u) return { ok: false, message: "That customer no longer exists." };
    const [firstName, ...rest] = (u.name ?? "Customer").split(" ");
    customer = { id: u.id, email: u.email, firstName, lastName: rest.join(" "), phone: u.profile?.phone ?? null };
  } else if (d.newCustomer) {
    const n = customerSchema.safeParse({ ...d.newCustomer, ...d.address });
    if (!n.success) return { ok: false, message: n.error.issues[0]?.message ?? "Check the customer's details." };
    if (d.saveCustomer) {
      try {
        const u = await saveCustomer(n.data);
        await logAudit(user.id, "customer.create", "User", u.id, { from: "create order" });
        customer = { id: u.id, email: u.email, firstName: n.data.firstName, lastName: n.data.lastName || "", phone: n.data.phone || null };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "Couldn't add the customer." };
      }
    } else {
      const name = [n.data.firstName, n.data.lastName].filter(Boolean).join(" ");
      customer = {
        id: null,
        email: n.data.email ? n.data.email.toLowerCase() : noEmailAddress(name),
        firstName: n.data.firstName,
        lastName: n.data.lastName || "",
        phone: n.data.phone || null,
      };
    }
  } else {
    return { ok: false, message: "Choose a customer or type in a new one." };
  }

  // what they bought
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: d.lines.map((l) => l.variantId) } },
    include: {
      product: { select: { id: true, title: true, sku: true, brand: { select: { name: true } }, images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 } } },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const qtyByVariant = new Map<string, number>();
  for (const l of d.lines) {
    if (!byId.has(l.variantId)) return { ok: false, message: "One of the products no longer exists. Remove it and add it again." };
    qtyByVariant.set(l.variantId, (qtyByVariant.get(l.variantId) ?? 0) + l.quantity);
  }
  if (d.takeStock) {
    for (const [id, qty] of qtyByVariant) {
      const v = byId.get(id)!;
      if (v.stock < qty) {
        const size = v.label ?? v.size ?? "";
        return {
          ok: false,
          message: `Only ${Math.max(0, v.stock)} of "${v.product.title}${size ? ` (${size})` : ""}" in stock. Lower the quantity, or untick "Take these pieces off the stock".`,
        };
      }
    }
  }

  const cents = (rupees: number) => Math.round(rupees * 100);
  const items = d.lines.map((l) => {
    const v = byId.get(l.variantId)!;
    return {
      productId: v.product.id,
      variantId: v.id,
      productTitle: v.product.title,
      variantLabel: v.label ?? ([v.size, v.color].filter(Boolean).join(" / ") || null),
      sku: v.sku ?? v.product.sku ?? null,
      brandName: v.product.brand?.name ?? null,
      image: v.image ?? v.product.images[0]?.url ?? null,
      unitPriceCents: cents(l.unitPrice),
      quantity: l.quantity,
    };
  });
  const subtotalCents = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  const discountCents = Math.min(cents(d.discount), subtotalCents);
  const shippingCents = cents(d.shipping);
  const settings = await getSiteSettings();
  const note = [`Created by admin. Sold via: ${d.channel || "not given"}.`, d.note].filter(Boolean).join("\n");

  try {
    const order = await prisma.$transaction(async (tx) => {
      const o = await createWithOrderNumber(tx, {
        userId: customer.id,
        email: customer.email,
        phone: customer.phone,
        firstName: customer.firstName,
        lastName: customer.lastName,
        shipLine1: d.address.line1 || "",
        shipLine2: d.address.line2 || null,
        shipCity: d.address.city || "",
        shipPostalCode: d.address.postalCode || "",
        shipCountry: "PK",
        currency: settings.baseCurrency,
        subtotalCents,
        shippingCents,
        discountCents,
        totalCents: subtotalCents - discountCents + shippingCents,
        shippingMethod: "standard",
        paymentMethod: d.paymentMethod,
        paymentStatus: d.paymentStatus,
        fulfillmentStatus: d.fulfillmentStatus,
        adminNote: note,
        createdAt,
        items: { create: items },
      });
      for (const [id, qty] of qtyByVariant) {
        const v = byId.get(id)!;
        if (d.takeStock) await tx.productVariant.update({ where: { id }, data: { stock: { decrement: qty } } });
        await tx.product.update({ where: { id: v.product.id }, data: { salesCount: { increment: qty } } });
      }
      return o;
    });
    await logAudit(user.id, "order.create_manual", "Order", order.id, {
      date: createdAt.toISOString(),
      channel: d.channel,
      pieces: d.lines.reduce((s, l) => s + l.quantity, 0),
      takeStock: d.takeStock,
    });
    revalidateAdmin();
    return { ok: true, orderNumber: order.orderNumber, message: `Order ${order.orderNumber} created.` };
  } catch (err) {
    console.error("[orders] Couldn't create the order.", err);
    return { ok: false, message: "Couldn't create the order. Please try again." };
  }
}

// ── made-up sales ────────────────────────────────────────────────────────────

const madeUpSchema = z.object({
  beauty: z.boolean(),
  soldOut: z.boolean(),
  from: z.string().min(1),
  to: z.string().min(1),
  min: z.number().int().min(1).max(20),
  max: z.number().int().min(1).max(20),
});

export async function generateMadeUpSales(input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = madeUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check the form." };
  const d = parsed.data;
  if (!d.beauty && !d.soldOut) return { ok: false, message: "Tick at least one group of products." };
  const from = fromPakistanTime(d.from);
  const toStart = fromPakistanTime(d.to);
  if (!from || !toStart) return { ok: false, message: "Choose both dates." };
  const to = new Date(toStart.getTime());
  if (from > to) return { ok: false, message: "The first date must be before the last date." };
  if (from.getTime() > Date.now()) return { ok: false, message: "Made-up sales can only be in the past." };
  const settings = await getSiteSettings();
  const res = await addMadeUpSales({
    scope: { beauty: d.beauty, soldOut: d.soldOut },
    from,
    to,
    min: Math.min(d.min, d.max),
    max: Math.max(d.min, d.max),
    shipping: { flatShippingCents: settings.flatShippingCents, freeShippingThresholdCents: settings.freeShippingThresholdCents },
    currency: settings.baseCurrency,
  });
  await logAudit(user.id, "order.made_up_add", "Order", undefined, { ...res, from: d.from, to: d.to, beauty: d.beauty, soldOut: d.soldOut });
  revalidateAdmin();
  if (res.orders === 0) return { ok: false, message: "No products matched, so nothing was added." };
  return { ok: true, message: `Added ${res.orders} made-up orders: ${res.pieces} pieces of ${res.products} products.` };
}

export async function removeMadeUpSales(): Promise<ActionResult> {
  const user = await requireAdmin();
  const { count } = await prisma.order.deleteMany({ where: MADE_UP });
  await logAudit(user.id, "order.made_up_remove", "Order", undefined, { removed: count });
  revalidateAdmin();
  return { ok: true, message: `Removed ${count} made-up orders.` };
}
