import type { Metadata } from "next";
import Link from "next/link";
import { getCart } from "@/lib/cart";
import { getActiveCurrency } from "@/lib/currency.server";
import { getSiteSettings } from "@/lib/settings";
import { computeTotals } from "@/lib/totals";
import { formatMoney } from "@/lib/money";
import { CartLineItem } from "@/components/cart/CartLineItem";

export const metadata: Metadata = { title: "Your Bag", robots: { index: false } };

export default async function CartPage() {
  const [cart, currency, settings] = await Promise.all([
    getCart(),
    getActiveCurrency(),
    getSiteSettings(),
  ]);

  if (cart.lines.length === 0) {
    return (
      <div className="container-site flex flex-col items-center py-24 text-center">
        <h1 className="text-2xl font-medium">Your bag is empty</h1>
        <p className="mt-2 text-ink-muted">Discover something you love.</p>
        <Link href="/collections/women" className="btn-primary mt-8">
          Continue shopping
        </Link>
      </div>
    );
  }

  const totals = computeTotals(cart.subtotalCents, settings);
  const hasStockIssue = cart.lines.some((l) => l.quantity > l.stock || l.stock <= 0);
  const threshold = settings.freeShippingThresholdCents;
  const remainingForFree = threshold != null ? threshold - cart.subtotalCents : 0;

  return (
    <div className="container-site py-10">
      <h1 className="text-3xl font-medium">Your Bag</h1>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_360px]">
        {/* line items */}
        <div className="divide-y divide-line border-y border-line">
          {cart.lines.map((line) => (
            <CartLineItem key={line.id} line={line} currency={currency} />
          ))}
        </div>

        {/* summary */}
        <aside className="h-fit border border-line p-6 lg:sticky lg:top-28">
          <h2 className="text-lg font-medium">Order summary</h2>

          {threshold != null && remainingForFree > 0 && (
            <p className="mt-3 rounded bg-line-soft px-3 py-2 text-xs text-ink-soft">
              Add {formatMoney(remainingForFree, currency)} more for free shipping.
            </p>
          )}

          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Subtotal" value={formatMoney(totals.subtotalCents, currency)} />
            <Row
              label="Shipping (estimate)"
              value={totals.shippingCents === 0 ? "Free" : formatMoney(totals.shippingCents, currency)}
            />
            <div className="flex justify-between text-ink-muted">
              <dt>Discount</dt>
              <dd>Applied at checkout</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-medium">
              <dt>Estimated total</dt>
              <dd>{formatMoney(totals.totalCents, currency)}</dd>
            </div>
          </dl>

          {hasStockIssue && (
            <p className="mt-4 text-sm text-sale">
              Some items exceed available stock. Please adjust quantities before checkout.
            </p>
          )}

          <Link
            href="/checkout"
            aria-disabled={hasStockIssue}
            className={`btn-primary mt-6 w-full ${hasStockIssue ? "pointer-events-none opacity-50" : ""}`}
          >
            Checkout
          </Link>
          <Link href="/collections/women" className="mt-3 block text-center text-sm text-ink-muted hover:text-ink">
            Continue shopping
          </Link>

          <p className="mt-5 text-center text-xs text-ink-muted">
            Taxes and discounts calculated at checkout.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
