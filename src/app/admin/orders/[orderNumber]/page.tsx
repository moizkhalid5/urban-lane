import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBaseCurrency } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderEditForm } from "@/components/admin/OrderEditForm";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const order = await prisma.order.findUnique({ where: { orderNumber }, include: { items: true } });
  if (!order) notFound();
  const currency = await getBaseCurrency();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/orders" className="text-sm text-ink-muted hover:text-ink">← Orders</Link>
          <h1 className="mt-1 text-2xl font-medium">{order.orderNumber}</h1>
          <p className="text-sm text-ink-muted">{order.createdAt.toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.paymentStatus} />
          <StatusBadge status={order.fulfillmentStatus} />
          <Link href={`/admin/orders/${order.orderNumber}/invoice`} className="btn-ghost" target="_blank">
            Invoice
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="card">
            <div className="border-b border-line p-4"><h2 className="font-medium">Items</h2></div>
            <table className="w-full text-sm">
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} className="border-b border-line-soft last:border-0">
                    <td className="p-3">
                      {it.productTitle}{it.variantLabel ? ` — ${it.variantLabel}` : ""}
                      {it.sku && <span className="block text-xs text-ink-muted">SKU: {it.sku}</span>}
                    </td>
                    <td className="p-3 text-center text-ink-muted">× {it.quantity}</td>
                    <td className="p-3 text-right">{formatMoney(it.unitPriceCents * it.quantity, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="space-y-1 border-t border-line p-4 text-sm">
              <Row label="Subtotal" value={formatMoney(order.subtotalCents, currency)} />
              {order.discountCents > 0 && <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`−${formatMoney(order.discountCents, currency)}`} />}
              <Row label="Shipping" value={order.shippingCents === 0 ? "Free" : formatMoney(order.shippingCents, currency)} />
              <div className="flex justify-between border-t border-line pt-2 font-medium">
                <dt>Total</dt><dd>{formatMoney(order.totalCents, currency)}</dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="card p-4 text-sm">
              <h3 className="mb-2 font-medium">Customer</h3>
              <p>{order.firstName} {order.lastName}</p>
              <p className="text-ink-muted">{order.email}</p>
              {order.phone && <p className="text-ink-muted">{order.phone}</p>}
            </div>
            <div className="card p-4 text-sm">
              <h3 className="mb-2 font-medium">Shipping address</h3>
              <p className="text-ink-soft">
                {order.shipLine1}{order.shipLine2 ? `, ${order.shipLine2}` : ""}<br />
                {order.shipCity}{order.shipState ? `, ${order.shipState}` : ""} {order.shipPostalCode}<br />
                {order.shipCountry}
              </p>
            </div>
          </div>

          {order.customerNote && (
            <div className="card p-4 text-sm">
              <h3 className="mb-1 font-medium">Customer note</h3>
              <p className="text-ink-soft">{order.customerNote}</p>
            </div>
          )}
        </div>

        <OrderEditForm
          orderNumber={order.orderNumber}
          initial={{
            paymentStatus: order.paymentStatus,
            fulfillmentStatus: order.fulfillmentStatus,
            trackingNumber: order.trackingNumber ?? "",
            trackingCarrier: order.trackingCarrier ?? "",
            adminNote: order.adminNote ?? "",
          }}
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-ink-soft">{label}</dt><dd>{value}</dd></div>;
}
