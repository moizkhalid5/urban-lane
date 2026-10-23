"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/guards";
import { orderUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { orderStatusTemplate, shippingConfirmationTemplate } from "@/lib/email/templates";
import { emailReviewRequest } from "@/lib/reviews/request";

export type OrderActionResult = { ok: boolean; message?: string };

export async function updateOrder(orderNumber: string, input: unknown): Promise<OrderActionResult> {
  const user = await requireStaff();
  const parsed = orderUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid update." };
  const d = parsed.data;

  const existing = await prisma.order.findUnique({ where: { orderNumber } });
  if (!existing) return { ok: false, message: "Order not found." };

  const updated = await prisma.order.update({
    where: { orderNumber },
    data: {
      paymentStatus: d.paymentStatus ?? undefined,
      fulfillmentStatus: d.fulfillmentStatus ?? undefined,
      trackingNumber: d.trackingNumber !== undefined ? d.trackingNumber || null : undefined,
      trackingCarrier: d.trackingCarrier !== undefined ? d.trackingCarrier || null : undefined,
      adminNote: d.adminNote !== undefined ? d.adminNote || null : undefined,
    },
  });

  // Notify the customer when fulfillment status changes.
  if (d.fulfillmentStatus && d.fulfillmentStatus !== existing.fulfillmentStatus) {
    if (d.fulfillmentStatus === "SHIPPED") {
      await sendEmail({
        to: updated.email,
        ...shippingConfirmationTemplate(orderNumber, updated.trackingNumber ?? undefined, updated.trackingCarrier ?? undefined),
      });
    } else if (d.fulfillmentStatus === "DELIVERED") {
      // The "delivered" email asks the customer to rate their order (lib/reviews/request).
      await emailReviewRequest(updated.id).catch((err) => console.error("[reviews] Couldn't send the review request.", err));
    } else {
      await sendEmail({
        to: updated.email,
        ...orderStatusTemplate(orderNumber, d.fulfillmentStatus.toLowerCase(), updated.trackingNumber ?? undefined),
      });
    }
  }

  await logAudit(user.id, "order.update", "Order", existing.id, {
    payment: d.paymentStatus,
    fulfillment: d.fulfillmentStatus,
  });

  revalidatePath(`/admin/orders/${orderNumber}`);
  revalidatePath("/admin/orders");
  return { ok: true, message: "Order updated." };
}
