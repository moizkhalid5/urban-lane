"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateReviewSettings } from "@/app/actions/reviews";
import type { ReviewSettingsData } from "@/lib/reviews/db";

/** Admin → Reviews: when stars and "sold" counts appear, and how customer reviews are handled. */
export function ReviewSettingsForm({ initial, canEdit }: { initial: ReviewSettingsData; canEdit: boolean }) {
  const router = useRouter();
  const [d, setD] = useState({ ...initial, minReviewsForStars: String(initial.minReviewsForStars), minSoldToShow: String(initial.minSoldToShow) });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await updateReviewSettings(d);
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Saved." : "Error.") });
      if (res.ok) router.refresh();
    });
  }

  return (
    <section className="card p-5">
      <h2 className="font-medium">Display settings</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Show a product&apos;s stars from</label>
          <div className="flex items-center gap-2 text-sm">
            <input type="number" min={1} value={d.minReviewsForStars} disabled={!canEdit} onChange={(e) => setD({ ...d, minReviewsForStars: e.target.value })} className="input w-24" />
            approved reviews
          </div>
        </div>
        <div>
          <label className="label">Show &ldquo;N sold&rdquo; from</label>
          <div className="flex items-center gap-2 text-sm">
            <input type="number" min={1} value={d.minSoldToShow} disabled={!canEdit} onChange={(e) => setD({ ...d, minSoldToShow: e.target.value })} className="input w-24" />
            sales (website orders + sales before the website)
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.allowCustomerReviews} disabled={!canEdit} onChange={(e) => setD({ ...d, allowCustomerReviews: e.target.checked })} className="h-4 w-4 accent-ink" />
          Customers can write reviews on product pages
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.autoApprove} disabled={!canEdit} onChange={(e) => setD({ ...d, autoApprove: e.target.checked })} className="h-4 w-4 accent-ink" />
          Publish customer reviews immediately (otherwise they wait here for approval)
        </label>
      </div>
      {canEdit ? (
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={save} disabled={pending} className="btn-primary">
            {pending ? "Saving…" : "Save settings"}
          </button>
          {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-sale"}`}>{msg.text}</p>}
        </div>
      ) : (
        <p className="mt-4 text-xs text-ink-muted">Only admins can change these settings.</p>
      )}
    </section>
  );
}
