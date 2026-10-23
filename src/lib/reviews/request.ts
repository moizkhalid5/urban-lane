import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/site";
import { sendEmail } from "@/lib/email";
import { reviewRequestTemplate } from "@/lib/email/templates";
import { ensureReviewTables } from "./db";

/**
 * "How was your order?" review requests. Each delivered order gets a private link,
 * /review/<order number>?t=<token>, where the customer rates what they bought without logging in. The token
 * is an HMAC of the order number with AUTH_SECRET, so links can't be guessed or edited to another order.
 */
function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export function reviewToken(orderNumber: string): string {
  return createHmac("sha256", secret()).update(`review:${orderNumber}`).digest("base64url").slice(0, 32);
}

export function isValidReviewToken(orderNumber: string, token: string | undefined): boolean {
  if (!token) return false;
  const a = Buffer.from(reviewToken(orderNumber));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function reviewLink(orderNumber: string): string {
  return `${APP_URL}/review/${encodeURIComponent(orderNumber)}?t=${reviewToken(orderNumber)}`;
}

/** Pakistani mobile numbers in wa.me form: "0332-5253799" → "923325253799". Null when it doesn't look valid. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("03")) d = `92${d.slice(1)}`;
  if (d.length === 10 && d.startsWith("3")) d = `92${d}`;
  return d.length >= 11 && d.length <= 15 ? d : null;
}

/** wa.me link with the request message typed in, for the admin to send from the store's WhatsApp. */
export function whatsappReviewLink(order: { orderNumber: string; firstName: string; phone: string | null }): string | null {
  const number = whatsappNumber(order.phone);
  if (!number) return null;
  const text =
    `Assalam o Alaikum ${order.firstName}! Thank you for shopping with Urban Lane. ` +
    `How was your order ${order.orderNumber}? Please rate it here (1 minute): ${reviewLink(order.orderNumber)}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Emails the review request for a delivered order and records it. Returns false if it wasn't sent. */
export async function emailReviewRequest(orderId: string): Promise<boolean> {
  await ensureReviewTables();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, email: true, firstName: true, fulfillmentStatus: true, items: { select: { productTitle: true } } },
  });
  if (!order || order.fulfillmentStatus !== "DELIVERED" || !order.email) return false;
  const items = [...new Set(order.items.map((i) => i.productTitle))];
  await sendEmail({ to: order.email, ...reviewRequestTemplate(order.firstName, order.orderNumber, items, reviewLink(order.orderNumber)) });
  await prisma.reviewRequest.upsert({
    where: { orderId: order.id },
    create: { orderId: order.id, emailedAt: new Date() },
    update: { emailedAt: new Date() },
  });
  return true;
}
