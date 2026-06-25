import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getActiveCurrency } from "@/lib/currency.server";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const currency = await getActiveCurrency();

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  if (orders.length === 0) {
    return (
      <div className="border border-dashed border-line p-12 text-center">
        <p className="text-lg font-medium">No orders yet</p>
        <Link href="/collections/women" className="btn-primary mt-6">Start shopping</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Order history</h2>
      <div className="divide-y divide-line border-y border-line">
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/account/orders/${o.orderNumber}`}
            className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-line-soft"
          >
            <div>
              <p className="font-medium">{o.orderNumber}</p>
              <p className="text-sm text-ink-muted">
                {o.createdAt.toLocaleDateString()} · {o.items.length} item(s)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={o.paymentStatus} />
              <StatusBadge status={o.fulfillmentStatus} />
            </div>
            <span className="font-medium">{formatMoney(o.totalCents, currency)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
