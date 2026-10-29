import type { Order } from "@prisma/client";
import { formatMoney } from "@/lib/money";
import { getBaseCurrency, getSiteSettings } from "@/lib/settings";
import { paymentLabel } from "@/lib/payments";
import { walletAccount } from "@/lib/payments/available";
import { getPaymentSettings } from "@/lib/payments/settings";
import { paymentConfirmation } from "@/lib/payments/confirm";
import { STORE_PHONE, STORE_PHONE_TEL } from "@/components/layout/SocialContact";
import { cn } from "@/lib/utils";

/**
 * An order's payment, for the customer (order confirmed page, My orders): how to pay while it's pending
 * (wallet number + WhatsApp button for the screenshot, bank details, or cash on delivery), then
 * "Payment received" once the store has confirmed it in Admin → Orders.
 */
export async function OrderPaymentBox({
  order,
  className,
}: {
  order: Pick<Order, "id" | "orderNumber" | "totalCents" | "paymentMethod" | "paymentStatus">;
  className?: string;
}) {
  const [base, settings, wallets] = await Promise.all([getBaseCurrency(), getSiteSettings(), getPaymentSettings()]);
  // Wallet and bank payments are made in rupees, so the amount to send is always in the base currency
  const amount = formatMoney(order.totalCents, base);
  const label = paymentLabel(order.paymentMethod);

  if (order.paymentStatus === "PAID") {
    const confirmed = order.paymentMethod === "COD" ? null : await paymentConfirmation(order.id);
    return (
      <div className={cn("flex items-start gap-3 border border-green-200 bg-green-50 p-4 text-sm text-green-800", className)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden>
          <path d="M5 13l4 4L19 7" />
        </svg>
        <div>
          <p className="font-medium">Payment received</p>
          <p className="mt-1">
            We&apos;ve received your payment of {amount} by {label}
            {confirmed && <> on {confirmed.at.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</>}. Thank you!
          </p>
        </div>
      </div>
    );
  }
  if (order.paymentStatus !== "PENDING") return null;

  const wallet = walletAccount(order.paymentMethod, wallets);
  if (wallet) {
    const receiptMessage = `Hi Urban Lane, I've sent ${amount} by ${label} for order ${order.orderNumber}. Here is the screenshot of the payment:`;
    const receiptUrl = `https://wa.me/${STORE_PHONE_TEL.replace(/\D/g, "")}?text=${encodeURIComponent(receiptMessage)}`;
    return (
      <div className={cn("border border-ink p-6 text-sm", className)}>
        <h2 className="text-sm font-medium uppercase tracking-wide">Pay by {label}</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-ink-soft">
          <li>
            Send <span className="font-medium text-ink">{amount}</span> to our {label} account{" "}
            <span className="whitespace-nowrap text-base font-medium tracking-wide text-ink">{wallet.number}</span>
            {wallet.name && <> ({wallet.name})</>}.
          </li>
          <li>
            Send a screenshot of the payment with your order number{" "}
            <span className="font-medium text-ink">{order.orderNumber}</span> on WhatsApp to {STORE_PHONE}.
          </li>
        </ol>
        <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5 w-full sm:w-auto">
          Send payment screenshot on WhatsApp
        </a>
        <p className="mt-4 text-xs text-ink-muted">
          We&apos;ll confirm your order as soon as the payment arrives, and email you when it&apos;s confirmed.
        </p>
      </div>
    );
  }

  const note =
    order.paymentMethod === "COD"
      ? `Please keep ${amount} ready in cash for delivery.`
      : order.paymentMethod === "BANK_TRANSFER"
        ? settings.bankTransferInstructions
          ? `${settings.bankTransferInstructions}\nAmount: ${amount}. Reference: ${order.orderNumber}.`
          : "Please complete your bank transfer using your order number as the reference."
        : null;
  if (!note) return null;
  return <p className={cn("whitespace-pre-line border border-line bg-line-soft p-4 text-sm text-ink-soft", className)}>{note}</p>;
}
