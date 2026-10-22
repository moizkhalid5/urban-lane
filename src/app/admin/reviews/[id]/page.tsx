import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/guards";
import { ensureReviewTables } from "@/lib/reviews/db";
import { ReviewEditor } from "@/components/admin/ReviewEditor";

export const dynamic = "force-dynamic";

const safeBack = (v?: string) => (v && /^\/admin\/[\w/-]*$/.test(v) ? v : "/admin/reviews");

export default async function EditReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  await requireStaff();
  await ensureReviewTables();
  const { id } = await params;
  const returnTo = safeBack((await searchParams).back);
  const [review, products] = await Promise.all([
    prisma.review.findUnique({ where: { id } }),
    prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  if (!review) notFound();

  return (
    <div className="space-y-6">
      <Link href={returnTo} className="text-sm text-ink-muted hover:text-ink">
        ← Back
      </Link>
      <h1 className="text-2xl font-medium">Edit review</h1>
      {review.email && (
        <p className="text-sm text-ink-muted">
          Written on the website by {review.email}
          {review.verifiedPurchase ? " (verified buyer)" : ""}.
        </p>
      )}
      <ReviewEditor
        id={review.id}
        products={products}
        returnTo={returnTo}
        initial={{
          productId: review.productId ?? "",
          authorName: review.authorName,
          authorCity: review.authorCity ?? "",
          rating: review.rating,
          title: review.title ?? "",
          body: review.body,
          source: review.source,
          status: review.status,
          verifiedPurchase: review.verifiedPurchase,
          featured: review.featured,
          reviewedAt: review.reviewedAt.toISOString().slice(0, 10),
        }}
      />
    </div>
  );
}
