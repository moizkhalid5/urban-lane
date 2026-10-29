import Link from "next/link";
import type { Prisma, FulfillmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBaseCurrency } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { paymentLabel } from "@/lib/payments";
import { PaymentReceivedTick } from "@/components/admin/PaymentReceivedTick";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const FULFILLMENT = ["UNFULFILLED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const currency = await getBaseCurrency();

  const where: Prisma.OrderWhereInput = {};
  if (q) {
    where.OR = [
      { orderNumber: { contains: q } },
      { email: { contains: q } },
    ];
  }
  if (status === "awaiting-payment") {
    // Paid in advance (Easypaisa, JazzCash, bank transfer) but not yet confirmed
    where.paymentStatus = "PENDING";
    where.paymentMethod = { not: "COD" };
  } else if (status === "pending") {
    where.OR = [{ paymentStatus: "PENDING" }, { fulfillmentStatus: "UNFULFILLED" }];
  } else if (FULFILLMENT.includes(status.toUpperCase())) {
    where.fulfillmentStatus = status.toUpperCase() as FulfillmentStatus;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { items: { select: { id: true } } },
    }),
    prisma.order.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium">Orders</h1>

      <form className="flex flex-wrap gap-3" action="/admin/orders">
        <input name="q" defaultValue={q} placeholder="Search order # or email" className="input max-w-xs" />
        <select name="status" defaultValue={status} className="input max-w-[12rem]">
          <option value="">All</option>
          <option value="awaiting-payment">Awaiting payment</option>
          <option value="pending">Pending / unfulfilled</option>
          {FULFILLMENT.map((f) => (
            <option key={f} value={f.toLowerCase()}>{f.charAt(0) + f.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Date</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Fulfillment</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-line-soft last:border-0 hover:bg-line-soft">
                <td className="p-3">
                  <Link href={`/admin/orders/${o.orderNumber}`} className="font-medium hover:underline">{o.orderNumber}</Link>
                </td>
                <td className="p-3">{o.firstName} {o.lastName}<br /><span className="text-xs text-ink-muted">{o.email}</span></td>
                <td className="p-3 text-ink-muted">{o.createdAt.toLocaleDateString()}</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StatusBadge status={o.paymentStatus} />
                    {o.paymentStatus === "PENDING" && (
                      <PaymentReceivedTick orderNumber={o.orderNumber} amount={formatMoney(o.totalCents, currency)} method={paymentLabel(o.paymentMethod)} compact />
                    )}
                  </div>
                  <span className="mt-1 block text-xs text-ink-muted">{paymentLabel(o.paymentMethod)}</span>
                </td>
                <td className="p-3"><StatusBadge status={o.fulfillmentStatus} /></td>
                <td className="p-3 text-right">{formatMoney(o.totalCents, currency)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-ink-muted">No orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/orders?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(p) })}`}
              className={`border px-3 py-1.5 ${p === page ? "border-ink bg-ink text-white" : "border-line"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
