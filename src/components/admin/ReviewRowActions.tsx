"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteReview, moveFeaturedReview, setReviewFeatured, setReviewStatus } from "@/app/actions/reviews";

/** Buttons on each row of Admin → Reviews. */
export function ReviewRowActions({
  id,
  status,
  featured,
  canMoveUp,
  canMoveDown,
  back,
}: {
  id: string;
  status: "PENDING" | "APPROVED" | "HIDDEN";
  featured: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** page to return to after editing (default: Admin → Reviews) */
  back?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  const btn = "text-xs underline-offset-2 hover:underline disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link href={`/admin/reviews/${id}${back ? `?back=${encodeURIComponent(back)}` : ""}`} className={btn}>
        Edit
      </Link>
      {status !== "APPROVED" && (
        <button type="button" disabled={pending} onClick={() => run(() => setReviewStatus(id, "APPROVED"))} className={`${btn} text-success`}>
          Approve
        </button>
      )}
      {status !== "HIDDEN" && (
        <button type="button" disabled={pending} onClick={() => run(() => setReviewStatus(id, "HIDDEN"))} className={btn}>
          Hide
        </button>
      )}
      <button type="button" disabled={pending} onClick={() => run(() => setReviewFeatured(id, !featured))} className={btn}>
        {featured ? "Remove from homepage" : "Show on homepage"}
      </button>
      {featured && (
        <>
          <button type="button" disabled={pending || !canMoveUp} onClick={() => run(() => moveFeaturedReview(id, -1))} className={btn} aria-label="Move earlier on the homepage">
            ↑
          </button>
          <button type="button" disabled={pending || !canMoveDown} onClick={() => run(() => moveFeaturedReview(id, 1))} className={btn} aria-label="Move later on the homepage">
            ↓
          </button>
        </>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this review permanently?")) run(() => deleteReview(id));
        }}
        className={`${btn} text-sale`}
      >
        Delete
      </button>
    </div>
  );
}
