import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getActiveCurrency } from "@/lib/currency.server";
import { formatMoney } from "@/lib/money";
import { paymentLabel } from "@/lib/payments";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderPaymentBox } from "@/components/checkout/OrderPaymentBox";
import { reviewToken } from "@/lib/reviews/request";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const user = await requireUser("/account/orders");
  const { orderNumber } = await params;
  const currency = await getActiveCurrency();

  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: user.id },
    include: { items: true },
  });
  if (!order) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/account/orders" className="text-sm text-ink-muted hover:text-ink">← All orders</Link>
          <h2 className="mt-1 text-2xl font-medium">{order.orderNumber}</h2>
          <p className="text-sm text-ink-muted">Placed {order.createdAt.toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={order.paymentStatus} />
          <StatusBadge status={order.fulfillmentStatus} />
        </div>
      </div>

      <OrderPaymentBox order={order} />

      {order.fulfillmentStatus === "DELIVERED" && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-line bg-line-soft p-4 text-sm">
          <span>How was your order? Rate what you bought.</span>
          <Link href={`/review/${encodeURIComponent(order.orderNumber)}?t=${reviewToken(order.orderNumber)}`} className="btn-primary">
            Rate your order
          </Link>
        </div>
      )}

      {order.trackingNumber && (
        <p className="border border-line bg-line-soft p-4 text-sm">
          Tracking: <strong>{order.trackingNumber}</strong>
          {order.trackingCarrier ? ` (${order.trackingCarrier})` : ""}
        </p>
      )}

      <div className="border border-line">
        <ul className="divide-y divide-line">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between p-4 text-sm">
              <span>
                {it.productTitle}
                {it.variantLabel ? ` — ${it.variantLabel}` : ""} × {it.quantity}
              </span>
              <span>{formatMoney(it.unitPriceCents * it.quantity, currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-line p-4 text-sm">
          <Row label="Subtotal" value={formatMoney(order.subtotalCents, currency)} />
          {order.discountCents > 0 && <Row label="Discount" value={`−${formatMoney(order.discountCents, currency)}`} />}
          <Row label="Shipping" value={order.shippingCents === 0 ? "Free" : formatMoney(order.shippingCents, currency)} />
          <div className="flex justify-between border-t border-line pt-2 text-base font-medium">
            <dt>Total</dt>
            <dd>{formatMoney(order.totalCents, currency)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="border border-line p-4 text-sm">
          <h3 className="mb-2 font-medium">Shipping address</h3>
          <p className="text-ink-soft">
            {order.firstName} {order.lastName}<br />
            {order.shipLine1}<br />
            {order.shipLine2 && <>{order.shipLine2}<br /></>}
            {order.shipCity}{order.shipState ? `, ${order.shipState}` : ""} {order.shipPostalCode}<br />
            {order.shipCountry}
          </p>
        </div>
        <div className="border border-line p-4 text-sm">
          <h3 className="mb-2 font-medium">Payment</h3>
          <p className="text-ink-soft">{paymentLabel(order.paymentMethod)}</p>
          {order.customerNote && (
            <>
              <h3 className="mb-2 mt-4 font-medium">Order notes</h3>
              <p className="text-ink-soft">{order.customerNote}</p>
            </>
          )}
        </div>
      </div>

      <Link href="/returns" className="inline-block text-sm text-ink-muted underline hover:text-ink">
        Need to return something?
      </Link>
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
