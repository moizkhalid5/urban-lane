import "server-only";
import type { PaymentMethod, PaymentSettings, SiteSettings } from "@prisma/client";
import { GATEWAYS } from "@/lib/payments";

/** `account` is the wallet number (and name, if set) customers send an Easypaisa or JazzCash payment to. */
export type AvailableMethod = { method: PaymentMethod; label: string; note?: string; account?: { number: string; name: string | null } };

/**
 * Payment methods offered at checkout = enabled in settings AND the gateway
 * reports itself available (keys present for card gateways). COD is hidden when
 * the order total exceeds the COD limit (0 = no limit), Bank Transfer until its
 * instructions are filled in, and a wallet until it has a number.
 */
export function availablePaymentMethods(settings: SiteSettings, wallets: PaymentSettings, totalCents: number): AvailableMethod[] {
  const out: AvailableMethod[] = [];

  const withinCodLimit = settings.codLimitCents <= 0 || totalCents <= settings.codLimitCents;
  if (settings.enableCOD && GATEWAYS.COD.isAvailable() && withinCodLimit) {
    out.push({ method: "COD", label: "Cash on Delivery" });
  }
  if (wallets.easypaisaEnabled && wallets.easypaisaNumber) {
    out.push({ method: "EASYPAISA", label: "Easypaisa", account: { number: wallets.easypaisaNumber, name: wallets.easypaisaName } });
  }
  if (wallets.jazzcashEnabled && wallets.jazzcashNumber) {
    out.push({ method: "JAZZCASH", label: "JazzCash", account: { number: wallets.jazzcashNumber, name: wallets.jazzcashName } });
  }
  if (settings.enableBankTransfer && settings.bankTransferInstructions?.trim() && GATEWAYS.BANK_TRANSFER.isAvailable()) {
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

/** The wallet account an Easypaisa or JazzCash order is paid to; null for other methods. */
export function walletAccount(method: PaymentMethod, wallets: PaymentSettings): { number: string; name: string | null } | null {
  if (method === "EASYPAISA" && wallets.easypaisaNumber) return { number: wallets.easypaisaNumber, name: wallets.easypaisaName };
  if (method === "JAZZCASH" && wallets.jazzcashNumber) return { number: wallets.jazzcashNumber, name: wallets.jazzcashName };
  return null;
}
