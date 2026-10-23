"use client";

import { useMemo, useState, useTransition } from "react";
import { submitReview } from "@/app/actions/reviews";
import type { ProductReviews as ProductReviewsData, PublicReview } from "@/lib/reviews/queries";
import { Star, Stars } from "./Stars";
import { SampleBadge, formatReviewDate } from "./ReviewBits";

type Sort = "newest" | "highest" | "lowest";

/** Product page review section: summary, star breakdown, review list with sorting, and "Write a review". */
export function ProductReviews({ productId, data }: { productId: string; data: ProductReviewsData }) {
  const [sort, setSort] = useState<Sort>("newest");
  const [shown, setShown] = useState(6);
  const [writing, setWriting] = useState(false);

  const sorted = useMemo(() => {
    const list = [...data.reviews];
    if (sort === "highest") list.sort((a, b) => b.rating - a.rating || b.reviewedAt.localeCompare(a.reviewedAt));
    else if (sort === "lowest") list.sort((a, b) => a.rating - b.rating || b.reviewedAt.localeCompare(a.reviewedAt));
    return list;
  }, [data.reviews, sort]);

  const total = data.summary.count;

  return (
    <section id="reviews" className="mt-20 scroll-mt-28 border-t border-line pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-medium">Customer reviews</h2>
        {data.allowCustomerReviews && !writing && (
          <button type="button" onClick={() => setWriting(true)} className="btn-secondary">
            Write a review
          </button>
        )}
      </div>

      {writing && <ReviewForm productId={productId} onClose={() => setWriting(false)} />}

      {total === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">
          No reviews yet.{data.allowCustomerReviews && " Be the first to share what you think of this product."}
        </p>
      ) : (
        <>
          <div className="mt-8 grid gap-8 border-b border-line pb-10 md:grid-cols-[16rem_1fr] md:gap-12">
            <div className="text-center md:border-r md:border-line md:pr-12">
              <p className="text-5xl font-medium">
                {data.summary.average.toFixed(1)}
                <span className="ml-1 text-base font-normal text-ink-muted">out of 5</span>
              </p>
              <Stars value={data.summary.average} size={20} className="mt-3" />
              <p className="mt-2 text-sm text-ink-muted">
                ({total} {total === 1 ? "review" : "reviews"})
              </p>
            </div>
            <ul className="space-y-2.5 self-center">
              {data.distribution.map((n, i) => (
                <li key={i} className="flex items-center gap-3 text-xs text-ink-muted">
                  <span className="w-10 shrink-0">{5 - i} star</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
                    <span className="block h-full rounded-full bg-[#e8a93a]" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
                  </span>
                  <span className="w-8 shrink-0 text-right">{n}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              Showing {Math.min(shown, total)} of {total} {total === 1 ? "review" : "reviews"}
            </p>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input w-auto py-1.5">
                <option value="newest">Newest</option>
                <option value="highest">Highest rating</option>
                <option value="lowest">Lowest rating</option>
              </select>
            </label>
          </div>

          <ul className="mt-4 divide-y divide-line">
            {sorted.slice(0, shown).map((r) => (
              <ReviewItem key={r.id} review={r} />
            ))}
          </ul>
          {shown < total && (
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setShown((s) => s + 6)} className="btn-secondary">
                Show more reviews
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ReviewItem({ review: r }: { review: PublicReview }) {
  return (
    <li className="py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-line-soft text-sm font-medium uppercase text-ink-soft">
            {r.authorName.trim().charAt(0)}
          </span>
          <div>
            <p className="text-sm font-medium">
              {r.authorName}
              {r.authorCity && <span className="font-normal text-ink-muted">, {r.authorCity}</span>}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              {r.verifiedPurchase && <span className="text-success">✓ Verified buyer</span>}
              {r.isSample && <SampleBadge />}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-xs text-ink-muted">{formatReviewDate(r.reviewedAt)}</p>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Stars value={r.rating} size={14} />
        {r.title && <p className="text-sm font-medium">{r.title}</p>}
      </div>
      {r.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{r.body}</p>}
    </li>
  );
}

function ReviewForm({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    start(async () => {
      const res = await submitReview({
        productId,
        rating,
        authorName: f.get("authorName"),
        authorCity: f.get("authorCity"),
        email: f.get("email"),
        title: f.get("title"),
        body: f.get("body"),
        website: f.get("website"),
      });
      setResult({ ok: res.ok, text: res.message ?? (res.ok ? "Thank you!" : "Something went wrong.") });
      if (res.ok) form.reset();
    });
  }

  if (result?.ok) {
    return (
      <div className="mt-6 border border-line bg-line-soft/40 p-6 text-sm">
        <p className="font-medium">{result.text}</p>
        <button type="button" onClick={onClose} className="mt-3 text-ink-muted underline">
          Close
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      className="mt-6 grid gap-4 border border-line p-6 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <p className="label">Your rating</p>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              className="p-0.5"
            >
              <Star filled={(hover || rating) >= n} size={26} />
            </button>
          ))}
        </div>
      </div>
      <Field name="authorName" label="Your name" required />
      <Field name="authorCity" label="City (optional)" />
      <Field name="email" label="Email (not shown)" type="email" required />
      <Field name="title" label="Review title (optional)" />
      <div className="sm:col-span-2">
        <label className="label" htmlFor="review-body">
          Your review (English or Roman Urdu)
        </label>
        <textarea id="review-body" name="body" rows={4} required minLength={10} maxLength={2000} className="input" />
      </div>
      {/* honeypot for bots; hidden from people */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Sending…" : "Submit review"}
        </button>
        <button type="button" onClick={onClose} className="text-sm text-ink-muted underline">
          Cancel
        </button>
        {result && !result.ok && <p className="text-sm text-sale">{result.text}</p>}
      </div>
    </form>
  );
}

function Field({ name, label, type = "text", required }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={`review-${name}`}>
        {label}
      </label>
      <input id={`review-${name}`} name={name} type={type} required={required} maxLength={120} className="input" />
    </div>
  );
}
