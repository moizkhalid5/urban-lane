import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBaseCurrency } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
      addresses: true,
      orders: { orderBy: { createdAt: "desc" }, include: { items: { select: { id: true } } } },
    },
  });
  if (!customer) notFound();
  const currency = await getBaseCurrency();

  const totalSpent = customer.orders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((s, o) => s + o.totalCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/customers" className="text-sm text-ink-muted hover:text-ink">← Customers</Link>
        <h1 className="mt-1 text-2xl font-medium">{customer.name ?? customer.email}</h1>
        <p className="text-sm text-ink-muted">{customer.email}{customer.profile?.phone ? ` · ${customer.profile.phone}` : ""}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-ink-muted">Orders</p><p className="mt-1 text-2xl font-medium">{customer.orders.length}</p></div>
        <div className="card p-5"><p className="text-sm text-ink-muted">Total spent (paid)</p><p className="mt-1 text-2xl font-medium">{formatMoney(totalSpent, currency)}</p></div>
        <div className="card p-5"><p className="text-sm text-ink-muted">Email verified</p><p className="mt-1 text-2xl font-medium">{customer.emailVerified ? "Yes" : "No"}</p></div>
      </div>

      <div className="card">
        <div className="border-b border-line p-4"><h2 className="font-medium">Orders</h2></div>
        {customer.orders.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">No orders.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {customer.orders.map((o) => (
                <tr key={o.id} className="border-b border-line-soft last:border-0">
                  <td className="p-3"><Link href={`/admin/orders/${o.orderNumber}`} className="font-medium hover:underline">{o.orderNumber}</Link></td>
                  <td className="p-3 text-ink-muted">{o.createdAt.toLocaleDateString()}</td>
                  <td className="p-3"><StatusBadge status={o.fulfillmentStatus} /></td>
                  <td className="p-3 text-right">{formatMoney(o.totalCents, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {customer.addresses.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 font-medium">Addresses</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {customer.addresses.map((a) => (
              <p key={a.id} className="text-sm text-ink-soft">
                {a.firstName} {a.lastName} — {a.line1}, {a.city} {a.postalCode}, {a.country}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
