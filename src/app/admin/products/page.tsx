import Link from "next/link";
import Image from "next/image";
import type { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBaseCurrency } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { UkPriceCell } from "@/components/admin/UkPriceCell";
import { compareWithUk, ensurePricingTables, getGbpToPkr } from "@/lib/pricing/uk-price";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; uk?: string }>;
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

  // UK price filter: missing / showing a saving / no saving (ours isn't lower).
  const ukFilter = ["missing", "saving", "nosaving"].includes(sp.uk ?? "") ? sp.uk! : "";
  const [gbpToPkr, ukRows] = await Promise.all([
    getGbpToPkr(),
    ensurePricingTables()
      .then(() => prisma.ukPrice.findMany({ select: { productId: true, pence: true, product: { select: { priceCents: true } } } }))
      .catch(() => []),
  ]);
  const ukPence = new Map(ukRows.map((r) => [r.productId, r.pence]));
  const savingIds = ukRows.filter((r) => compareWithUk(r.product.priceCents, r.pence, gbpToPkr)).map((r) => r.productId);
  const savingSet = new Set(savingIds);
  if (ukFilter === "missing") where.id = { notIn: [...ukPence.keys()] };
  if (ukFilter === "saving") where.id = { in: savingIds };
  if (ukFilter === "nosaving") where.id = { in: [...ukPence.keys()].filter((id) => !savingSet.has(id)) };
  const allCount = await prisma.product.count({ where: { ...where, id: undefined } });
  const ukCounts = {
    missing: await prisma.product.count({ where: { ...where, id: { notIn: [...ukPence.keys()] } } }),
    saving: await prisma.product.count({ where: { ...where, id: { in: savingIds } } }),
    nosaving: await prisma.product.count({ where: { ...where, id: { in: [...ukPence.keys()].filter((id) => !savingSet.has(id)) } } }),
  };

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
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/products/uk-prices" className="btn-secondary">Import UK prices</Link>
          <Link href="/admin/products/new" className="btn-primary">Add product</Link>
        </div>
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
        <select name="uk" defaultValue={ukFilter} className="input max-w-[16rem]">
          <option value="">UK price: all ({allCount})</option>
          <option value="missing">Missing UK price ({ukCounts.missing})</option>
          <option value="saving">Showing a saving ({ukCounts.saving})</option>
          <option value="nosaving">No saving: ours isn&apos;t lower ({ukCounts.nosaving})</option>
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
              <th className="p-3 text-right">UK price</th>
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
                  <td className="p-3">
                    <UkPriceCell
                      key={`${p.id}-${ukPence.get(p.id) ?? ""}`}
                      productId={p.id}
                      ourPrice={p.priceCents / 100}
                      initialPounds={ukPence.has(p.id) ? String(ukPence.get(p.id)! / 100) : ""}
                      gbpToPkr={gbpToPkr}
                    />
                  </td>
                  <td className={`p-3 text-right ${stock <= 0 ? "text-sale" : ""}`}>{stock}</td>
                  <td className="p-3"><ProductRowActions id={p.id} status={p.status} /></td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-ink-muted">No products found.</td>
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
              href={`/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(statusFilter ? { status: statusFilter } : {}), ...(ukFilter ? { uk: ukFilter } : {}), page: String(p) })}`}
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
