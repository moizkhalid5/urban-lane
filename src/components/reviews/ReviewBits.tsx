/** Small pieces shared by the product page reviews and the homepage carousel. */

export function formatReviewDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Marks local design-preview reviews (scripts/sample-reviews.ts); they never appear on the live site. */
export function SampleBadge() {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
      Sample review
    </span>
  );
}
