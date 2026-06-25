import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { InventoryRow } from "@/components/admin/InventoryRow";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const filter = sp.filter ?? "";

  const where: Prisma.ProductVariantWhereInput = { isActive: true };
  if (q) where.product = { title: { contains: q } };
  if (filter === "low") where.stock = { lte: 5 };
  if (filter === "out") where.stock = { lte: 0 };

  const variants = await prisma.productVariant.findMany({
    where,
    orderBy: { stock: "asc" },
    take: 200,
    include: { product: { select: { title: true, lowStockThreshold: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium">Inventory</h1>

      <form className="flex flex-wrap gap-3" action="/admin/inventory">
        <input name="q" defaultValue={q} placeholder="Search product" className="input max-w-xs" />
        <select name="filter" defaultValue={filter} className="input max-w-[12rem]">
          <option value="">All</option>
          <option value="low">Low stock (≤5)</option>
          <option value="out">Out of stock</option>
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Variant</th>
              <th className="p-3">SKU</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Stock</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <InventoryRow
                key={v.id}
                variantId={v.id}
                product={v.product.title}
                label={v.label ?? ""}
                sku={v.sku ?? ""}
                stock={v.stock}
                threshold={v.product.lowStockThreshold}
              />
            ))}
            {variants.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-ink-muted">No matching variants.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-ink-muted">Showing up to 200 variants. <Link href="/admin/products" className="underline">Manage products</Link> for full editing.</p>
    </div>
  );
}
