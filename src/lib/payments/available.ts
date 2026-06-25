import "server-only";
import type { PaymentMethod, SiteSettings } from "@prisma/client";
import { GATEWAYS } from "@/lib/payments";

export type AvailableMethod = { method: PaymentMethod; label: string; note?: string };

/**
 * Payment methods offered at checkout = enabled in settings AND the gateway
 * reports itself available (keys present for card gateways). COD is hidden when
 * the order total exceeds the COD limit.
 */
export function availablePaymentMethods(settings: SiteSettings, totalCents: number): AvailableMethod[] {
  const out: AvailableMethod[] = [];

  if (settings.enableCOD && GATEWAYS.COD.isAvailable() && totalCents <= settings.codLimitCents) {
    out.push({ method: "COD", label: "Cash on Delivery" });
  }
  if (settings.enableBankTransfer && GATEWAYS.BANK_TRANSFER.isAvailable()) {
    out.push({ method: "BANK_TRANSFER", label: "Bank Transfer" });
  }
  if (settings.enableCard && GATEWAYS.STRIPE.isAvailable()) {
    out.push({ method: "STRIPE", label: "Credit / Debit Card" });
  }
  if (settings.enablePaypal && GATEWAYS.PAYPAL.isAvailable()) {
    out.push({ method: "PAYPAL", label: "PayPal" });
  }

  return out;
}
