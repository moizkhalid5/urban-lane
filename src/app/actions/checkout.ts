"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getCart, CART_COOKIE } from "@/lib/cart";
import { getSiteSettings } from "@/lib/settings";
import { computeTotals } from "@/lib/totals";
import { checkoutSchema } from "@/lib/validation";
import { generateOrderNumber } from "@/lib/order-number";
import { availablePaymentMethods, walletAccount } from "@/lib/payments/available";
import { getPaymentSettings } from "@/lib/payments/settings";
import { getGateway } from "@/lib/payments";
import { sendEmail, STORE_NOTIFICATIONS_EMAIL } from "@/lib/email";
import { orderConfirmationTemplate } from "@/lib/email/templates";
import { formatMoney } from "@/lib/money";
import { getBaseCurrency } from "@/lib/settings";

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; redirectUrl?: string }
  | { ok: false; error: string };

/** Validate an optional coupon code; returns the coupon or null (never throws). */
async function resolveCoupon(code: string | undefined, subtotalCents: number) {
  if (!code) return null;
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon || !coupon.isActive) return null;
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return null;
  if (coupon.endsAt && coupon.endsAt < now) return null;
  if (coupon.minSubtotalCents && subtotalCents < coupon.minSubtotalCents) return null;
  if (coupon.maxRedemptions != null && coupon.timesRedeemed >= coupon.maxRedemptions) return null;
  return coupon;
}

export async function placeOrder(raw: unknown): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const data = parsed.data;

  const wallets = await getPaymentSettings();
  const [cart, settings, session] = await Promise.all([getCart(), getSiteSettings(), auth()]);
  if (cart.lines.length === 0 || !cart.id) {
    return { ok: false, error: "Your bag is empty." };
  }

  // Server-authoritative subtotal (never trust the client).
  const subtotalCents = cart.lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const coupon = await resolveCoupon(data.couponCode || undefined, subtotalCents);
  const totals = computeTotals(subtotalCents, settings, coupon);

  // Payment method must be currently offered (respects settings + COD limit + gateway availability).
  const allowed = availablePaymentMethods(settings, wallets, totals.totalCents);
  if (!allowed.some((m) => m.method === data.paymentMethod)) {
    return { ok: false, error: "Selected payment method is not available for this order." };
  }

  const gateway = getGateway(data.paymentMethod);
  if (!gateway.isAvailable()) {
    return { ok: false, error: `${gateway.label} is currently unavailable.` };
  }

  const orderNumber = generateOrderNumber();

  try {
    await prisma.$transaction(async (tx) => {
      // Re-read variants inside the transaction and verify stock atomically.
      for (const line of cart.lines) {
        const variant = await tx.productVariant.findUnique({
          where: { id: line.variantId },
          include: { product: { select: { status: true, title: true } } },
        });
        if (!variant || !variant.isActive || variant.product.status !== "ACTIVE") {
          throw new Error(`"${line.title}" is no longer available.`);
        }
        if (variant.stock < line.quantity) {
          throw new Error(`Not enough stock for "${line.title}" (only ${variant.stock} left).`);
        }
      }

      await tx.order.create({
        data: {
          orderNumber,
          userId: session?.user?.id ?? null,
          email: data.email,
          phone: data.phone,
          firstName: data.firstName,
          lastName: data.lastName,
          shipLine1: data.line1,
          shipLine2: data.line2 || null,
          shipCity: data.city,
          shipState: data.state || null,
          shipPostalCode: data.postalCode,
          shipCountry: data.country,
          currency: settings.baseCurrency,
          subtotalCents: totals.subtotalCents,
          shippingCents: totals.shippingCents,
          discountCents: totals.discountCents,
          totalCents: totals.totalCents,
          shippingMethod: data.shippingMethod,
          couponCode: coupon?.code ?? null,
          paymentMethod: data.paymentMethod,
          paymentStatus: "PENDING",
          fulfillmentStatus: "UNFULFILLED",
          customerNote: data.customerNote || null,
          items: {
            create: cart.lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              productTitle: l.title,
              variantLabel: l.variantLabel,
              brandName: l.brand,
              image: l.image,
              unitPriceCents: l.unitPriceCents,
              quantity: l.quantity,
            })),
          },
        },
      });

      // Decrement stock + bump sales counters.
      for (const line of cart.lines) {
        await tx.productVariant.update({
          where: { id: line.variantId },
          data: { stock: { decrement: line.quantity } },
        });
        await tx.product.update({
          where: { id: line.productId },
          data: { salesCount: { increment: line.quantity } },
        });
      }

      if (coupon) {
        await tx.coupon.update({ where: { id: coupon.id }, data: { timesRedeemed: { increment: 1 } } });
      }

      // Clear the cart.
      await tx.cartItem.deleteMany({ where: { cartId: cart.id! } });
    });
  } catch (err) {
    const message = err instanceof Prisma.PrismaClientKnownRequestError
      ? "Could not place your order. Please try again."
      : err instanceof Error
        ? err.message
        : "Could not place your order.";
    return { ok: false, error: message };
  }

  // Hand off to the payment gateway (offline methods simply record intent).
  const init = await gateway.initiate({
    orderNumber,
    amountMinor: totals.totalCents,
    currency: settings.baseCurrency,
    email: data.email,
  });

  // Send transactional emails (best-effort; never blocks order success).
  const base = await getBaseCurrency();
  const confirmation = orderConfirmationTemplate({
    orderNumber,
    customerName: data.firstName,
    totalFormatted: formatMoney(totals.totalCents, base),
    payment: {
      label: gateway.label,
      account: walletAccount(data.paymentMethod, wallets),
      bankInstructions: data.paymentMethod === "BANK_TRANSFER" ? settings.bankTransferInstructions : null,
    },
    lines: cart.lines.map((l) => ({
      title: `${l.title}${l.variantLabel ? ` (${l.variantLabel})` : ""}`,
      qty: l.quantity,
      priceFormatted: formatMoney(l.lineTotalCents, base),
    })),
  });
  await sendEmail({ to: data.email, ...confirmation });
  await sendEmail({
    to: STORE_NOTIFICATIONS_EMAIL,
    subject: `New order ${orderNumber}`,
    html: confirmation.html,
    text: confirmation.text,
    replyTo: data.email,
  });

  // Clear the guest cart cookie so a fresh cart starts next time.
  if (!session?.user?.id) {
    (await cookies()).delete(CART_COOKIE);
  }

  revalidatePath("/cart");

  if (init.kind === "redirect") return { ok: true, orderNumber, redirectUrl: init.url };
  return { ok: true, orderNumber };
}
