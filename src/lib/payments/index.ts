/**
 * Payment gateway abstraction.
 *
 * Every method implements the same `PaymentGateway` contract, so checkout code
 * is provider-agnostic. These work out of the box with no external keys:
 *   - COD                 (cash on delivery; subject to the COD limit in settings, 0 = no limit)
 *   - BANK_TRANSFER       (manual bank transfer; shows instructions, order = PENDING)
 *   - EASYPAISA, JAZZCASH (customer sends the total to the store's wallet number, order = PENDING;
 *                          numbers in lib/payments/settings.ts)
 *
 * Card gateways (Stripe, PayPal, Safepay, PayFast, generic CARD) are stubs that
 * declare themselves unavailable until credentials + adapter logic are added.
 * NEVER store raw card details — these gateways hand off to the provider.
 */
import type { PaymentMethod } from "@prisma/client";

export type PaymentInitResult =
  | { kind: "placed"; paymentStatus: "PENDING" | "PAID"; message?: string }
  | { kind: "redirect"; url: string }
  | { kind: "error"; message: string };

export type PaymentContext = {
  orderNumber: string;
  amountMinor: number;
  currency: string;
  email: string;
};

export interface PaymentGateway {
  method: PaymentMethod;
  label: string;
  /** Whether this gateway is usable given current env/settings. */
  isAvailable(): boolean;
  /** Begin payment. For offline methods this just records intent. */
  initiate(ctx: PaymentContext): Promise<PaymentInitResult>;
}

const codGateway: PaymentGateway = {
  method: "COD",
  label: "Cash on Delivery",
  isAvailable: () => true,
  async initiate() {
    return { kind: "placed", paymentStatus: "PENDING", message: "Pay in cash on delivery." };
  },
};

const bankTransferGateway: PaymentGateway = {
  method: "BANK_TRANSFER",
  label: "Bank Transfer",
  isAvailable: () => true,
  async initiate() {
    return {
      kind: "placed",
      paymentStatus: "PENDING",
      message: "Transfer the total to the bank account shown, then await confirmation.",
    };
  },
};

function walletGateway(method: PaymentMethod, label: string): PaymentGateway {
  return {
    method,
    label,
    isAvailable: () => true,
    async initiate() {
      return { kind: "placed", paymentStatus: "PENDING", message: `Send the total to our ${label} account, then await confirmation.` };
    },
  };
}

// ── Card gateway stubs ───────────────────────────────────────────────────────
function stub(method: PaymentMethod, label: string, envKey: string): PaymentGateway {
  return {
    method,
    label,
    isAvailable: () => Boolean(process.env[envKey]),
    async initiate() {
      // TODO: implement provider session/redirect once credentials are configured.
      return {
        kind: "error",
        message: `${label} is not yet integrated. Add ${envKey} and complete the adapter.`,
      };
    },
  };
}

const stripeGateway = stub("STRIPE", "Card (Stripe)", "STRIPE_SECRET_KEY");
const paypalGateway = stub("PAYPAL", "PayPal", "PAYPAL_CLIENT_ID");
const safepayGateway = stub("SAFEPAY", "Safepay", "SAFEPAY_API_KEY");
const payfastGateway = stub("PAYFAST", "PayFast", "PAYFAST_MERCHANT_ID");
const cardGateway = stub("CARD", "Card", "STRIPE_SECRET_KEY");
const easypaisaGateway = walletGateway("EASYPAISA", "Easypaisa");
const jazzcashGateway = walletGateway("JAZZCASH", "JazzCash");

export const GATEWAYS: Record<PaymentMethod, PaymentGateway> = {
  COD: codGateway,
  BANK_TRANSFER: bankTransferGateway,
  EASYPAISA: easypaisaGateway,
  JAZZCASH: jazzcashGateway,
  CARD: cardGateway,
  STRIPE: stripeGateway,
  PAYPAL: paypalGateway,
  SAFEPAY: safepayGateway,
  PAYFAST: payfastGateway,
};

export function getGateway(method: PaymentMethod): PaymentGateway {
  return GATEWAYS[method];
}

/** How a payment method is written for customers and on invoices, e.g. "Cash on Delivery", "JazzCash". */
export function paymentLabel(method: PaymentMethod): string {
  return GATEWAYS[method]?.label ?? method.replace(/_/g, " ");
}
