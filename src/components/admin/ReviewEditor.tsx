"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveReview } from "@/app/actions/reviews";
import { Star } from "@/components/reviews/Stars";
import { SOURCE_LABELS } from "@/lib/reviews/labels";

export type ReviewEditorData = {
  productId: string;
  authorName: string;
  authorCity: string;
  rating: number;
  title: string;
  body: string;
  source: string;
  status: string;
  verifiedPurchase: boolean;
  featured: boolean;
  reviewedAt: string; // yyyy-mm-dd
};

/** Admin → Reviews: add a review from customer feedback (WhatsApp, Instagram…) or edit an existing one. */
export function ReviewEditor({
  id,
  initial,
  products,
  returnTo = "/admin/reviews",
}: {
  id: string | null;
  initial: ReviewEditorData;
  products: { id: string; title: string }[];
  /** where to go after saving or cancelling */
  returnTo?: string;
}) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [filter, setFilter] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof ReviewEditorData>(k: K, v: ReviewEditorData[K]) => setD((s) => ({ ...s, [k]: v }));

  const options = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? products.filter((p) => p.title.toLowerCase().includes(q)) : products;
    // keep the selected product in the list even when filtered out
    const selected = products.find((p) => p.id === d.productId);
    return selected && !list.includes(selected) ? [selected, ...list] : list;
  }, [products, filter, d.productId]);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveReview(id, d);
      if (res.ok) {
        router.push(returnTo);
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.message ?? "Couldn't save." });
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-sale"}`}>{msg.text}</p>}

      <section className="card space-y-4 p-5">
        <h2 className="font-medium">Product</h2>
        <div>
          <label className="label">Search products</label>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Type to filter, e.g. charcoal jacket" className="input" />
        </div>
        <div>
          <label className="label">Product reviewed</label>
          <select value={d.productId} onChange={(e) => set("productId", e.target.value)} className="input">
            <option value="">No specific product (review of the store)</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">
            {filter ? `${options.length} matching products` : `${products.length} products`}. A review of the store in
            general doesn&apos;t count towards any product&apos;s stars, but can be shown on the homepage.
          </p>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-medium">Review</h2>
        <div>
          <label className="label">Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => set("rating", n)} className="p-0.5">
                <Star filled={d.rating >= n} size={28} />
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Customer name" value={d.authorName} onChange={(v) => set("authorName", v)} />
          <Text label="City (optional)" value={d.authorCity} onChange={(v) => set("authorCity", v)} />
        </div>
        <Text label="Title (optional)" value={d.title} onChange={(v) => set("title", v)} />
        <div>
          <label className="label">Review text (as the customer wrote it, English or Roman Urdu)</label>
          <textarea value={d.body} onChange={(e) => set("body", e.target.value)} rows={5} className="input" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Received via</label>
            <select value={d.source} onChange={(e) => set("source", e.target.value)} className="input">
              {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date the customer gave it</label>
            <input type="date" value={d.reviewedAt} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set("reviewedAt", e.target.value)} className="input" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.verifiedPurchase} onChange={(e) => set("verifiedPurchase", e.target.checked)} className="h-4 w-4 accent-ink" />
          Verified buyer (this customer bought the product from us)
        </label>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-medium">Publishing</h2>
        <div>
          <label className="label">Status</label>
          <select value={d.status} onChange={(e) => set("status", e.target.value)} className="input">
            <option value="APPROVED">Approved: shown on the website</option>
            <option value="PENDING">Pending: waiting for approval</option>
            <option value="HIDDEN">Hidden: not shown</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.featured} onChange={(e) => set("featured", e.target.checked)} className="h-4 w-4 accent-ink" />
          Show on the homepage in &ldquo;Customer reviews&rdquo;
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save review"}
        </button>
        <Link href={returnTo} className="btn-secondary">
          Cancel
        </Link>
      </div>
    </div>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input" />
    </div>
  );
}
