import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getActiveCurrency } from "@/lib/currency.server";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function AccountOverviewPage() {
  const user = await requireUser("/account");
  const currency = await getActiveCurrency();

  const [orderCount, recentOrders, defaultAddress, wishlistCount] = await Promise.all([
    prisma.order.count({ where: { userId: user.id } }),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { items: { select: { id: true } } },
    }),
    prisma.address.findFirst({ where: { userId: user.id }, orderBy: { isDefault: "desc" } }),
    prisma.wishlistItem.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Orders" value={orderCount} href="/account/orders" />
        <Stat label="Wishlist items" value={wishlistCount} href="/wishlist" />
        <Stat label="Saved addresses" value={defaultAddress ? 1 : 0} href="/account/addresses" />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">Recent orders</h2>
          <Link href="/account/orders" className="text-sm text-ink-muted hover:text-ink">View all</Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="border border-dashed border-line p-8 text-center text-sm text-ink-muted">
            You haven&apos;t placed any orders yet.
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-4">
                <div>
                  <Link href={`/account/orders/${o.orderNumber}`} className="font-medium hover:underline">
                    {o.orderNumber}
                  </Link>
                  <p className="text-sm text-ink-muted">
                    {o.createdAt.toLocaleDateString()} · {o.items.length} item(s)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={o.fulfillmentStatus} />
                  <span className="text-sm font-medium">{formatMoney(o.totalCents, currency)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="border border-line p-5 transition-colors hover:border-ink">
      <p className="text-3xl font-medium">{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
    </Link>
  );
}
