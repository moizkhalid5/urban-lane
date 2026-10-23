"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { ensureReviewTables, getReviewSettings } from "@/lib/reviews/db";
import { emailReviewRequest, isValidReviewToken } from "@/lib/reviews/request";

export type RequestResult = { ok: boolean; message?: string };

// ── Customers: rate the items of a delivered order (/review/<order number>) ──

const orderReviewSchema = z.object({
  authorName: z.string().trim().min(2, "Please enter your name.").max(60),
  authorCity: z.string().trim().max(60).optional().default(""),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        rating: z.coerce.number().int().min(0).max(5),
        body: z.string().trim().max(2000).optional().default(""),
      }),
    )
    .max(50),
});

export async function submitOrderReviews(orderNumber: string, token: string, input: unknown): Promise<RequestResult> {
  if (!isValidReviewToken(orderNumber, token)) return { ok: false, message: "This review link isn't valid." };
  const parsed = orderReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;
  const rated = d.items.filter((i) => i.rating >= 1);
  if (rated.length === 0) return { ok: false, message: "Please choose stars for at least one item." };

  const settings = await getReviewSettings();
  if (!settings.allowCustomerReviews) return { ok: false, message: "Reviews are closed at the moment." };
  await ensureReviewTables();

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { email: true, userId: true, fulfillmentStatus: true, items: { select: { productId: true, product: { select: { slug: true } } } } },
  });
  if (!order || order.fulfillmentStatus !== "DELIVERED") return { ok: false, message: "This order can be reviewed once it has been delivered." };

  const slugs = new Map(order.items.flatMap((i) => (i.productId && i.product ? [[i.productId, i.product.slug] as const] : [])));
  const email = order.email.toLowerCase();
  const already = new Set(
    (await prisma.review.findMany({ where: { email, productId: { in: [...slugs.keys()] } }, select: { productId: true } })).map((r) => r.productId),
  );
  const fresh = rated.filter((i) => slugs.has(i.productId) && !already.has(i.productId));
  if (fresh.length === 0) return { ok: true, message: "You've already reviewed these items. Thank you!" };

  await prisma.review.createMany({
    data: fresh.map((i) => ({
      productId: i.productId,
      authorName: d.authorName,
      authorCity: d.authorCity || null,
      email,
      userId: order.userId,
      rating: i.rating,
      body: i.body,
      source: "WEBSITE" as const,
      status: settings.autoApprove ? ("APPROVED" as const) : ("PENDING" as const),
      verifiedPurchase: true,
    })),
  });
  for (const i of fresh) revalidatePath(`/products/${slugs.get(i.productId)}`);
  revalidatePath("/admin/reviews");
  return {
    ok: true,
    message: settings.autoApprove
      ? "Thank you! Your review is now on the product page."
      : "Thank you! Your review will appear on the product page once it has been checked.",
  };
}

// ── Admin: send requests (Admin → Reviews → Ask customers, and each order's page) ──

function revalidateRequests(orderNumber?: string) {
  revalidatePath("/admin/reviews/requests");
  if (orderNumber) revalidatePath(`/admin/orders/${orderNumber}`);
}

export async function sendReviewRequestEmail(orderNumber: string): Promise<RequestResult> {
  const user = await requireStaff();
  const order = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
  if (!order) return { ok: false, message: "Order not found." };
  const sent = await emailReviewRequest(order.id);
  if (!sent) return { ok: false, message: "Only delivered orders can be asked for a review." };
  await logAudit(user.id, "review_request.email", "Order", order.id);
  revalidateRequests(orderNumber);
  return { ok: true, message: "Email sent." };
}

/** Emails every delivered order that hasn't been asked yet, up to `limit` per click (mail hosts cap sending). */
export async function emailAllNotAsked(limit = 100): Promise<RequestResult> {
  const user = await requireStaff();
  await ensureReviewTables();
  const orders = await prisma.order.findMany({
    where: { fulfillmentStatus: "DELIVERED", reviewRequest: { is: null } },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
    take: Math.min(Math.max(1, limit), 200),
  });
  let sent = 0;
  for (const o of orders) if (await emailReviewRequest(o.id).catch(() => false)) sent++;
  await logAudit(user.id, "review_request.email_all", "Order", undefined, { sent });
  revalidateRequests();
  return { ok: true, message: `Emailed ${sent} ${sent === 1 ? "customer" : "customers"}.` };
}

/** Records that the WhatsApp message was opened for sending (the button opens wa.me with the text typed in). */
export async function markWhatsappSent(orderNumber: string): Promise<RequestResult> {
  const user = await requireStaff();
  await ensureReviewTables();
  const order = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
  if (!order) return { ok: false, message: "Order not found." };
  await prisma.reviewRequest.upsert({
    where: { orderId: order.id },
    create: { orderId: order.id, whatsappAt: new Date() },
    update: { whatsappAt: new Date() },
  });
  await logAudit(user.id, "review_request.whatsapp", "Order", order.id);
  revalidateRequests(orderNumber);
  return { ok: true };
}
