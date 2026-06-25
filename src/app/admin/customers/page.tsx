import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const where: Prisma.UserWhereInput = { role: "CUSTOMER" };
  if (q) where.OR = [{ email: { contains: q } }, { name: { contains: q } }];

  const customers = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { orders: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium">Customers</h1>

      <form className="flex gap-3" action="/admin/customers">
        <input name="q" defaultValue={q} placeholder="Search name or email" className="input max-w-xs" />
        <button className="btn-secondary">Search</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Verified</th>
              <th className="p-3">Joined</th>
              <th className="p-3 text-right">Orders</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-line-soft last:border-0 hover:bg-line-soft">
                <td className="p-3">
                  <Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">{c.name ?? "—"}</Link>
                </td>
                <td className="p-3 text-ink-muted">{c.email}</td>
                <td className="p-3">{c.emailVerified ? "✓" : "—"}</td>
                <td className="p-3 text-ink-muted">{c.createdAt.toLocaleDateString()}</td>
                <td className="p-3 text-right">{c._count.orders}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-ink-muted">No customers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
