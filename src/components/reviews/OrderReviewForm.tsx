"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitOrderReviews } from "@/app/actions/review-requests";
import { Star } from "./Stars";

type Item = { productId: string; title: string; image: string | null; slug: string; reviewed: boolean };

/** /review/<order number>: stars (and optional words) for each item of a delivered order, sent together. */
export function OrderReviewForm({
  orderNumber,
  token,
  defaultName,
  defaultCity,
  items,
}: {
  orderNumber: string;
  token: string;
  defaultName: string;
  defaultCity: string;
  items: Item[];
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const open = items.filter((i) => !i.reviewed);

  if (result?.ok || open.length === 0) {
    return (
      <div className="mt-8 border border-line bg-line-soft/40 p-6">
        <p className="font-medium">{result?.text ?? "You've already reviewed everything in this order. Thank you!"}</p>
        <Link href="/" className="mt-3 inline-block text-sm underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    start(async () => {
      const res = await submitOrderReviews(orderNumber, token, {
        authorName: f.get("authorName"),
        authorCity: f.get("authorCity"),
        items: open.map((i) => ({ productId: i.productId, rating: ratings[i.productId] ?? 0, body: bodies[i.productId] ?? "" })),
      });
      setResult({ ok: res.ok, text: res.message ?? (res.ok ? "Thank you!" : "Something went wrong.") });
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      className="mt-8 space-y-6"
    >
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.productId} className="flex gap-4 border border-line p-4">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt="" className="h-24 w-20 shrink-0 bg-line-soft object-cover" />
            ) : (
              <div className="h-24 w-20 shrink-0 bg-line-soft" />
            )}
            <div className="min-w-0 flex-1">
              <Link href={`/products/${item.slug}`} className="text-sm font-medium hover:underline">
                {item.title}
              </Link>
              {item.reviewed ? (
                <p className="mt-2 text-sm text-success">✓ Already reviewed. Thank you!</p>
              ) : (
                <>
                  <StarPicker
                    label={item.title}
                    value={ratings[item.productId] ?? 0}
                    onChange={(n) => setRatings((r) => ({ ...r, [item.productId]: n }))}
                  />
                  <textarea
                    aria-label={`Your review of ${item.title} (optional)`}
                    placeholder="Fit, quality, delivery… (optional)"
                    value={bodies[item.productId] ?? ""}
                    onChange={(e) => setBodies((b) => ({ ...b, [item.productId]: e.target.value }))}
                    rows={2}
                    maxLength={2000}
                    className="input mt-2 text-sm"
                  />
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="order-review-name">
            Name shown with your review
          </label>
          <input id="order-review-name" name="authorName" defaultValue={defaultName} required maxLength={60} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="order-review-city">
            City (optional)
          </label>
          <input id="order-review-city" name="authorCity" defaultValue={defaultCity} maxLength={60} className="input" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Sending…" : "Submit review"}
        </button>
        {result && !result.ok && <p className="text-sm text-sale">{result.text}</p>}
      </div>
      <p className="text-xs text-ink-muted">Your review is marked as a verified buyer. Your email address is never shown.</p>
    </form>
  );
}

function StarPicker({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="mt-2 flex gap-1" role="radiogroup" aria-label={`Your rating for ${label}`} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="p-0.5"
        >
          <Star filled={(hover || value) >= n} size={26} />
        </button>
      ))}
    </div>
  );
}
