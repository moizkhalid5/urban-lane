import Link from "next/link";
import Image from "next/image";
import type { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBaseCurrency } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProductRowActions } from "@/components/admin/ProductRowActions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const statusFilter = sp.status?.toUpperCase();
  const page = Math.max(1, Number(sp.page) || 1);
  const currency = await getBaseCurrency();

  const where: Prisma.ProductWhereInput = {};
  if (q) where.OR = [{ title: { contains: q } }, { sku: { contains: q } }];
  if (statusFilter && ["DRAFT", "ACTIVE", "ARCHIVED"].includes(statusFilter)) {
    where.status = statusFilter as ProductStatus;
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        brand: { select: { name: true } },
        images: { take: 1, orderBy: { position: "asc" } },
        variants: { select: { stock: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">Products</h1>
        <Link href="/admin/products/new" className="btn-primary">Add product</Link>
      </div>

      {/* filters */}
      <form className="flex flex-wrap gap-3" action="/admin/products">
        <input name="q" defaultValue={q} placeholder="Search title or SKU" className="input max-w-xs" />
        <select name="status" defaultValue={statusFilter ?? ""} className="input max-w-[12rem]">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-right">Stock</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const stock = p.variants.reduce((s, v) => s + v.stock, 0);
              return (
                <tr key={p.id} className="border-b border-line-soft last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-10 shrink-0 overflow-hidden bg-line-soft">
                        {p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="40px" className="object-cover" />}
                      </div>
                      <div>
                        <p className="font-medium">{p.title}</p>
                        <p className="text-xs text-ink-muted">{p.brand?.name ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3"><StatusBadge status={p.status} /></td>
                  <td className="p-3 text-right">{formatMoney(p.priceCents, currency)}</td>
                  <td className={`p-3 text-right ${stock <= 0 ? "text-sale" : ""}`}>{stock}</td>
                  <td className="p-3"><ProductRowActions id={p.id} status={p.status} /></td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-ink-muted">No products found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(statusFilter ? { status: statusFilter } : {}), page: String(p) })}`}
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
