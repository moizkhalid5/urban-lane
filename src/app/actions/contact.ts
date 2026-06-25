"use server";

import { prisma } from "@/lib/prisma";
import { contactSchema, refundSchema } from "@/lib/validation";
import { sendEmail, STORE_NOTIFICATIONS_EMAIL } from "@/lib/email";
import { contactNotificationTemplate, refundNotificationTemplate } from "@/lib/email/templates";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export type FormState = { ok: boolean; message: string };

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const limit = rateLimit(await clientKey("contact"), 5, 15 * 60 * 1000);
  if (!limit.ok) return { ok: false, message: "Too many submissions. Please try again later." };

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject") || "",
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const d = parsed.data;

  await prisma.contactMessage.create({
    data: { name: d.name, email: d.email, subject: d.subject || null, message: d.message },
  });

  // Notify the store; reply-to is the customer (issues doc: messages must reach the official address).
  const tpl = contactNotificationTemplate(d.name, d.email, d.subject || "", d.message);
  await sendEmail({ to: STORE_NOTIFICATIONS_EMAIL, ...tpl, replyTo: d.email });

  return { ok: true, message: "Thanks for reaching out — we'll get back to you shortly." };
}

export async function submitRefund(_prev: FormState, formData: FormData): Promise<FormState> {
  const limit = rateLimit(await clientKey("refund"), 5, 15 * 60 * 1000);
  if (!limit.ok) return { ok: false, message: "Too many submissions. Please try again later." };

  const parsed = refundSchema.safeParse({
    email: formData.get("email"),
    orderNumber: formData.get("orderNumber") || "",
    subject: formData.get("subject"),
    reason: formData.get("reason"),
    attachment: formData.get("attachment") || "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please complete all required fields." };
  }
  const d = parsed.data;

  const order = d.orderNumber ? await prisma.order.findUnique({ where: { orderNumber: d.orderNumber } }) : null;

  await prisma.refundRequest.create({
    data: {
      orderId: order?.id ?? null,
      email: d.email,
      subject: d.subject,
      reason: d.reason,
      attachment: d.attachment || null,
    },
  });

  const tpl = refundNotificationTemplate(d.email, d.subject, d.reason, d.orderNumber || undefined);
  await sendEmail({ to: STORE_NOTIFICATIONS_EMAIL, ...tpl, replyTo: d.email });

  return { ok: true, message: "Your return/refund request has been submitted. Our team will be in touch." };
}
