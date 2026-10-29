import "server-only";
import type { Order } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { paymentReceivedTemplate } from "@/lib/email/templates";
import { formatMoney } from "@/lib/money";
import { getBaseCurrency } from "@/lib/settings";
import { APP_URL } from "@/lib/site";
import { paymentLabel } from "@/lib/payments";

/**
 * Payment verification: once the store sees the money has arrived (e.g. the customer's Easypaisa / JazzCash
 * screenshot on WhatsApp matches the account), staff tick "Payment received" in Admin → Orders. The order
 * becomes PAID, an order that hadn't started moves to PROCESSING, the customer's order pages show it as
 * paid, and the customer is emailed.
 */
export const PAYMENT_CONFIRMED = "order.payment_confirmed";

export type ConfirmResult = { ok: boolean; message: string };

export async function confirmPaymentReceived(orderNumber: string, staffId: string): Promise<ConfirmResult> {
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) return { ok: false, message: "Order not found." };
  if (order.paymentStatus === "PAID") return { ok: true, message: "This order was already marked paid." };
  if (order.paymentStatus !== "PENDING") return { ok: false, message: `Payment is ${order.paymentStatus.toLowerCase().replace(/_/g, " ")}; change it in Update order.` };

  const preparing = order.fulfillmentStatus === "UNFULFILLED";
  // Only a still-pending order is changed, so two people ticking at once send one email
  const { count } = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: "PENDING" },
    data: { paymentStatus: "PAID", ...(preparing && { fulfillmentStatus: "PROCESSING" }) },
  });
  if (count === 0) return { ok: true, message: "This order was already marked paid." };

  await logAudit(staffId, PAYMENT_CONFIRMED, "Order", order.id, { method: order.paymentMethod, amountCents: order.totalCents });
  const emailed = await emailPaymentReceived(order, preparing);
  return { ok: true, message: emailed ? `Payment confirmed. ${order.email} has been emailed.` : "Payment confirmed, but the email couldn't be sent." };
}

/** The "we've received your payment" email. Best-effort: returns false instead of throwing. */
export async function emailPaymentReceived(order: Order, preparing: boolean): Promise<boolean> {
  try {
    const base = await getBaseCurrency();
    // Guests have no account, so their link is the order's confirmation page
    const orderUrl = order.userId ? `${APP_URL}/account/orders/${order.orderNumber}` : `${APP_URL}/checkout/success/${order.orderNumber}`;
    await sendEmail({
      to: order.email,
      ...paymentReceivedTemplate({
        orderNumber: order.orderNumber,
        customerName: order.firstName,
        amountFormatted: formatMoney(order.totalCents, base),
        methodLabel: paymentLabel(order.paymentMethod),
        preparing,
        orderUrl,
      }),
    });
    return true;
  } catch (err) {
    console.error("[payments] Couldn't send the payment received email.", err);
    return false;
  }
}

/** When and by whom an order's payment was confirmed, from the audit log. */
export async function paymentConfirmation(orderId: string): Promise<{ at: Date; by: string | null } | null> {
  const row = await prisma.auditLog.findFirst({
    where: { action: PAYMENT_CONFIRMED, entity: "Order", entityId: orderId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, user: { select: { name: true, email: true } } },
  });
  return row ? { at: row.createdAt, by: row.user?.name || row.user?.email || null } : null;
}
