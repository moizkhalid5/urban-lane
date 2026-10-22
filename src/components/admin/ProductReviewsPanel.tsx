import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ensureReviewTables } from "@/lib/reviews/db";
import { SOURCE_LABELS } from "@/lib/reviews/labels";
import { Stars } from "@/components/reviews/Stars";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReviewRowActions } from "./ReviewRowActions";

/** Admin product page: this product's rating and reviews, with add / edit / hide / delete. */
export async function ProductReviewsPanel({ productId }: { productId: string }) {
  const reviews = await ensureReviewTables()
    .then(() => prisma.review.findMany({ where: { productId }, orderBy: { reviewedAt: "desc" } }))
    .catch(() => []);
  const featuredOrder = await prisma.review
    .findMany({ where: { featured: true }, orderBy: [{ featuredPosition: "asc" }, { reviewedAt: "desc" }], select: { id: true } })
    .then((r) => r.map((x) => x.id))
    .catch(() => [] as string[]);
  const approved = reviews.filter((r) => r.status === "APPROVED" && !r.isSample);
  const average = approved.length ? Math.round((approved.reduce((s, r) => s + r.rating, 0) / approved.length) * 10) / 10 : 0;
  const back = encodeURIComponent(`/admin/products/${productId}`);

  return (
    <section className="card max-w-4xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Reviews</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
            {approved.length > 0 ? (
              <>
                <Stars value={average} size={14} /> {average.toFixed(1)} from {approved.length} approved{" "}
                {approved.length === 1 ? "review" : "reviews"}
              </>
            ) : (
              "No approved reviews yet. The rating appears once you add some."
            )}
          </p>
        </div>
        <Link href={`/admin/reviews/new?product=${productId}&back=${back}`} className="btn-primary">
          + Add review
        </Link>
      </div>

      {reviews.length > 0 && (
        <ul className="mt-4 divide-y divide-line-soft border-t border-line-soft">
          {reviews.map((r) => {
            const pos = featuredOrder.indexOf(r.id);
            return (
              <li key={r.id} className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} size={13} />
                    {r.title && <span className="font-medium">{r.title}</span>}
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-ink-soft">{r.body}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {r.authorName}
                    {r.authorCity && `, ${r.authorCity}`} · {SOURCE_LABELS[r.source] ?? r.source} ·{" "}
                    {r.reviewedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {r.featured && ` · homepage #${pos + 1}`}
                    {r.isSample && " · SAMPLE (local preview)"}
                  </p>
                </div>
                <ReviewRowActions
                  id={r.id}
                  status={r.status}
                  featured={r.featured}
                  canMoveUp={pos > 0}
                  canMoveDown={pos >= 0 && pos < featuredOrder.length - 1}
                  back={`/admin/products/${productId}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
