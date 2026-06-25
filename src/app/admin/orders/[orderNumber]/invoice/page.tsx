import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBaseCurrency } from "@/lib/settings";
import { getSiteSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const [order, currency, settings] = await Promise.all([
    prisma.order.findUnique({ where: { orderNumber }, include: { items: true } }),
    getBaseCurrency(),
    getSiteSettings(),
  ]);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-sm text-ink">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold uppercase tracking-[0.15em]">{settings.storeName}</h1>
          <p className="text-ink-muted">{settings.storeEmail}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-medium">Invoice</p>
          <p className="text-ink-muted">{order.orderNumber}</p>
          <p className="text-ink-muted">{order.createdAt.toLocaleDateString()}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">Bill to</p>
          <p>{order.firstName} {order.lastName}</p>
          <p className="text-ink-soft">{order.email}</p>
          {order.phone && <p className="text-ink-soft">{order.phone}</p>}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">Ship to</p>
          <p className="text-ink-soft">
            {order.shipLine1}{order.shipLine2 ? `, ${order.shipLine2}` : ""}<br />
            {order.shipCity}{order.shipState ? `, ${order.shipState}` : ""} {order.shipPostalCode}<br />
            {order.shipCountry}
          </p>
        </div>
      </div>

      <table className="w-full border-t border-line">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
            <th className="py-2">Item</th>
            <th className="py-2 text-center">Qty</th>
            <th className="py-2 text-right">Unit</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it) => (
            <tr key={it.id} className="border-b border-line-soft">
              <td className="py-2">{it.productTitle}{it.variantLabel ? ` — ${it.variantLabel}` : ""}</td>
              <td className="py-2 text-center">{it.quantity}</td>
              <td className="py-2 text-right">{formatMoney(it.unitPriceCents, currency)}</td>
              <td className="py-2 text-right">{formatMoney(it.unitPriceCents * it.quantity, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-56 space-y-1">
        <Row label="Subtotal" value={formatMoney(order.subtotalCents, currency)} />
        {order.discountCents > 0 && <Row label="Discount" value={`−${formatMoney(order.discountCents, currency)}`} />}
        <Row label="Shipping" value={order.shippingCents === 0 ? "Free" : formatMoney(order.shippingCents, currency)} />
        <div className="flex justify-between border-t border-line pt-1 font-medium">
          <span>Total</span><span>{formatMoney(order.totalCents, currency)}</span>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-ink-muted">
        Payment method: {order.paymentMethod.replace(/_/g, " ")} · Thank you for shopping with {settings.storeName}.
      </p>

      <div className="mt-8 text-center">
        <PrintButton />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-ink-soft"><span>{label}</span><span>{value}</span></div>;
}
