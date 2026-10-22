import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { ReviewImport } from "@/components/admin/ReviewImport";

export const dynamic = "force-dynamic";

export default async function ImportReviewsPage() {
  await requireStaff();
  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/reviews" className="text-sm text-ink-muted hover:text-ink">
        ← Reviews
      </Link>
      <h1 className="text-2xl font-medium">Import reviews</h1>
      <p className="max-w-3xl text-sm text-ink-muted">
        Add many reviews at once from the feedback you&apos;ve collected (WhatsApp, Instagram, in store). Each product&apos;s
        stars and review count update from them automatically.
      </p>
      <ReviewImport />
    </div>
  );
}
