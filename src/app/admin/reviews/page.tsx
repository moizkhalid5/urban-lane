import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/guards";
import { ensureReviewTables, getReviewSettings } from "@/lib/reviews/db";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Stars } from "@/components/reviews/Stars";
import { ReviewRowActions } from "@/components/admin/ReviewRowActions";
import { ReviewSettingsForm } from "@/components/admin/ReviewSettingsForm";
import { SOURCE_LABELS } from "@/lib/reviews/labels";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "pending", label: "Waiting for approval" },
  { key: "approved", label: "Approved" },
  { key: "homepage", label: "On the homepage" },
  { key: "hidden", label: "Hidden" },
  { key: "all", label: "All" },
] as const;

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const user = await requireStaff();
  await ensureReviewTables();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const [settings, counts, featuredCount] = await Promise.all([
    getReviewSettings(),
    prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.review.count({ where: { featured: true } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const tabCount: Record<string, number> = {
    pending: countOf("PENDING"),
    approved: countOf("APPROVED"),
    hidden: countOf("HIDDEN"),
    homepage: featuredCount,
    all: counts.reduce((n, c) => n + c._count._all, 0),
  };
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : tabCount.pending > 0 ? "pending" : "all";

  const where: Prisma.ReviewWhereInput = {};
  if (tab === "pending") where.status = "PENDING";
  if (tab === "approved") where.status = "APPROVED";
  if (tab === "hidden") where.status = "HIDDEN";
  if (tab === "homepage") where.featured = true;
  if (q) where.OR = [{ authorName: { contains: q } }, { body: { contains: q } }, { product: { title: { contains: q } } }];

  const reviews = await prisma.review.findMany({
    where,
    orderBy: tab === "homepage" ? [{ featuredPosition: "asc" }, { reviewedAt: "desc" }] : { createdAt: "desc" },
    include: { product: { select: { title: true, slug: true } } },
    take: 200,
  });
  const featuredOrder = (
    await prisma.review.findMany({ where: { featured: true }, orderBy: [{ featuredPosition: "asc" }, { reviewedAt: "desc" }], select: { id: true } })
  ).map((r) => r.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium">Reviews</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/reviews/import" className="btn-secondary">
            Import from Excel
          </Link>
          <Link href="/admin/reviews/new" className="btn-primary">
            + Add review
          </Link>
        </div>
      </div>
      <p className="max-w-3xl text-sm text-ink-muted">
        Customers can write reviews on any product page. To add feedback a customer sent you on WhatsApp, Instagram or in
        person, use <strong>Add review</strong>. A product&apos;s stars and review count are worked out from its approved
        reviews. Tick <strong>Show on homepage</strong> to put a review in the homepage carousel, and use ↑ ↓ to order them.
      </p>

      <ReviewSettingsForm initial={settings} canEdit={user.role === "ADMIN"} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/reviews?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                tab === t.key ? "border-ink bg-ink text-white" : "border-line text-ink-soft hover:border-ink",
              )}
            >
              {t.label} ({tabCount[t.key]})
            </Link>
          ))}
        </nav>
        <form className="flex gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" defaultValue={q} placeholder="Search name, text or product" className="input w-64" />
          <button className="btn-secondary">Search</button>
        </form>
      </div>

      <section className="card overflow-x-auto">
        {reviews.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">No reviews here yet.</p>
        ) : (
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="p-3">Review</th>
                <th className="p-3">Product</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => {
                const pos = featuredOrder.indexOf(r.id);
                return (
                  <tr key={r.id} className="border-b border-line-soft align-top last:border-0">
                    <td className="max-w-md p-3">
                      <div className="flex items-center gap-2">
                        <Stars value={r.rating} size={13} />
                        {r.title && <span className="font-medium">{r.title}</span>}
                      </div>
                      <p className="mt-1 line-clamp-3 text-ink-soft">{r.body}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {r.authorName}
                        {r.authorCity && `, ${r.authorCity}`} · {SOURCE_LABELS[r.source] ?? r.source} ·{" "}
                        {r.reviewedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {r.verifiedPurchase && " · ✓ verified buyer"}
                        {r.isSample && " · SAMPLE (local preview)"}
                      </p>
                    </td>
                    <td className="p-3">
                      {r.product ? (
                        <Link href={`/products/${r.product.slug}`} className="hover:underline" target="_blank">
                          {r.product.title}
                        </Link>
                      ) : (
                        <span className="text-ink-muted">Store review</span>
                      )}
                    </td>
                    <td className="space-y-1 p-3">
                      <StatusBadge status={r.status} />
                      {r.featured && <p className="text-xs text-ink-muted">Homepage #{pos + 1}</p>}
                    </td>
                    <td className="p-3">
                      <ReviewRowActions
                        id={r.id}
                        status={r.status}
                        featured={r.featured}
                        canMoveUp={pos > 0}
                        canMoveDown={pos >= 0 && pos < featuredOrder.length - 1}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
