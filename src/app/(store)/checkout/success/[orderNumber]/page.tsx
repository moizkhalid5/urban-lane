import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCurrency } from "@/lib/currency.server";
import { formatMoney } from "@/lib/money";
import { OrderPaymentBox } from "@/components/checkout/OrderPaymentBox";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

export default async function OrderSuccessPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });
  if (!order) notFound();

  const currency = await getActiveCurrency();

  return (
    <div className="container-site max-w-2xl py-16">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-6 text-3xl font-medium">Thank you for your order</h1>
        <p className="mt-2 text-ink-muted">
          Order <span className="font-medium text-ink">{order.orderNumber}</span> has been received. A confirmation
          email is on its way to {order.email}.
        </p>
      </div>

      <div className="mt-10 border border-line">
        <div className="border-b border-line p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide">Order summary</h2>
          <ul className="mt-4 divide-y divide-line">
            {order.items.map((it) => (
              <li key={it.id} className="flex justify-between py-3 text-sm">
                <span>
                  {it.productTitle}
                  {it.variantLabel ? ` — ${it.variantLabel}` : ""} × {it.quantity}
                </span>
                <span>{formatMoney(it.unitPriceCents * it.quantity, currency)}</span>
              </li>
            ))}
          </ul>
        </div>
        <dl className="space-y-2 p-6 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Subtotal</dt>
            <dd>{formatMoney(order.subtotalCents, currency)}</dd>
          </div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-success">
              <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
              <dd>−{formatMoney(order.discountCents, currency)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink-soft">Shipping</dt>
            <dd>{order.shippingCents === 0 ? "Free" : formatMoney(order.shippingCents, currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-medium">
            <dt>Total</dt>
            <dd>{formatMoney(order.totalCents, currency)}</dd>
          </div>
        </dl>
      </div>

      <OrderPaymentBox order={order} className="mt-6" />

      <div className="mt-10 flex justify-center gap-4">
        <Link href="/" className="btn-secondary">Continue shopping</Link>
        <Link href="/account/orders" className="btn-primary">View my orders</Link>
      </div>
    </div>
  );
}
