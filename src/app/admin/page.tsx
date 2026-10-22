import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getBaseCurrency } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { uploadFolderStatus } from "@/lib/storage";
import { findProductsWithMissingImages } from "@/lib/storage/missing-images";
import { ensureReviewTables } from "@/lib/reviews/db";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const currency = await getBaseCurrency();

  const [totalOrders, revenueAgg, pendingOrders, recentOrders, lowStock, topProducts, customerCount, missingPhotos, photosFolder, pendingReviews] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalCents: true } }),
      prisma.order.count({ where: { OR: [{ paymentStatus: "PENDING" }, { fulfillmentStatus: "UNFULFILLED" }] } }),
      prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { items: { select: { id: true } } } }),
      prisma.productVariant.findMany({
        where: { stock: { lte: 5 } },
        orderBy: { stock: "asc" },
        take: 8,
        include: { product: { select: { title: true, slug: true, lowStockThreshold: true } } },
      }),
      prisma.product.findMany({ orderBy: { salesCount: "desc" }, take: 5, select: { id: true, title: true, slug: true, salesCount: true } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      findProductsWithMissingImages().catch(() => []),
      uploadFolderStatus(),
      ensureReviewTables()
        .then(() => prisma.review.count({ where: { status: "PENDING" } }))
        .catch(() => 0),
    ]);

  const revenue = revenueAgg._sum.totalCents ?? 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-medium">Dashboard</h1>

      {photosFolder.ok ? (
        <p className="text-sm text-ink-muted">
          Photos folder: <code className="text-ink">{photosFolder.dir}</code> ({photosFolder.photoCount} uploaded photos)
        </p>
      ) : (
        <div className="border border-sale bg-sale/5 p-4 text-sm text-ink">
          <p className="font-medium text-sale">Photo uploads aren&apos;t set up correctly</p>
          <p className="mt-1 text-ink-soft">
            {photosFolder.problem}
            {photosFolder.dir && (
              <>
                {" "}Current folder: <code>{photosFolder.dir}</code>.
              </>
            )}
          </p>
          <p className="mt-1 text-ink-soft">
            In hPanel, set the <code>UPLOAD_DIR</code> environment variable to a folder outside the website&apos;s
            deployment folder (for example <code>/home/&lt;your account&gt;/urban-lane-uploads</code>) and restart the app.
            The deployment folder is <code>{photosFolder.appDir}</code>; anything inside it is deleted on redeploy.
          </p>
        </div>
      )}

      {pendingReviews > 0 && (
        <Link href="/admin/reviews?tab=pending" className="card block p-4 text-sm transition-colors hover:border-ink">
          <span className="font-medium">
            {pendingReviews} customer {pendingReviews === 1 ? "review is" : "reviews are"} waiting for approval
          </span>
          <span className="ml-2 text-ink-muted">Review now →</span>
        </Link>
      )}

      {missingPhotos.length > 0 && (
        <section className="border border-sale bg-sale/5 p-4 text-sm text-ink">
          <p className="font-medium text-sale">
            {missingPhotos.length} {missingPhotos.length === 1 ? "product has" : "products have"} missing photos
          </p>
          <p className="mt-1 text-ink-soft">
            These photo files no longer exist, so the shop shows an empty grey frame. Open each product, remove the
            photos marked &ldquo;Missing&rdquo; (the &times; button) and upload them again. You can choose several photos at
            once.
          </p>
          <ul className="mt-3 divide-y divide-line-soft border-t border-line-soft">
            {missingPhotos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                <span className="shrink-0 text-ink-muted">{p.missing} of {p.total} photos missing</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Total revenue (paid)" value={formatMoney(revenue, currency)} />
        <Card label="Total orders" value={String(totalOrders)} href="/admin/orders" />
        <Card label="Pending / unfulfilled" value={String(pendingOrders)} href="/admin/orders?status=pending" />
        <Card label="Customers" value={String(customerCount)} href="/admin/customers" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* recent orders */}
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 className="font-medium">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm text-ink-muted hover:text-ink">View all</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">No orders yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="p-3">Order</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-line-soft last:border-0">
                    <td className="p-3">
                      <Link href={`/admin/orders/${o.orderNumber}`} className="font-medium hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="p-3 text-ink-muted">{o.createdAt.toLocaleDateString()}</td>
                    <td className="p-3"><StatusBadge status={o.fulfillmentStatus} /></td>
                    <td className="p-3 text-right">{formatMoney(o.totalCents, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* top products */}
        <section className="card">
          <div className="border-b border-line p-4">
            <h2 className="font-medium">Top products</h2>
          </div>
          <ul className="divide-y divide-line-soft">
            {topProducts.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-3 text-sm">
                <Link href={`/products/${p.slug}`} className="truncate hover:underline">{p.title}</Link>
                <span className="ml-2 shrink-0 text-ink-muted">{p.salesCount} sold</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* low stock */}
      <section className="card">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-medium">Low / out of stock</h2>
          <Link href="/admin/inventory" className="text-sm text-ink-muted hover:text-ink">Manage inventory</Link>
        </div>
        {lowStock.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">All stock levels are healthy.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">Variant</th>
                <th className="p-3 text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((v) => (
                <tr key={v.id} className="border-b border-line-soft last:border-0">
                  <td className="p-3">
                    <Link href={`/products/${v.product.slug}`} className="hover:underline">{v.product.title}</Link>
                  </td>
                  <td className="p-3 text-ink-muted">{v.label ?? "—"}</td>
                  <td className={`p-3 text-right font-medium ${v.stock <= 0 ? "text-sale" : "text-amber-600"}`}>
                    {v.stock}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Card({ label, value, href }: { label: string; value: string; href?: string }) {
  const inner = (
    <>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-medium">{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="card p-5 transition-colors hover:border-ink">{inner}</Link>
  ) : (
    <div className="card p-5">{inner}</div>
  );
}
