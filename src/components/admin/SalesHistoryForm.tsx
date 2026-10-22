"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPriorSales } from "@/app/actions/sales-history";

/** Admin product page: website sales (from orders) plus sales made before the website, which staff enter. */
export function SalesHistoryForm({
  productId,
  websiteSales,
  initialUnits,
  initialNote,
  minSoldToShow,
}: {
  productId: string;
  websiteSales: number;
  initialUnits: number;
  initialNote: string;
  minSoldToShow: number;
}) {
  const router = useRouter();
  const [units, setUnits] = useState(String(initialUnits));
  const [note, setNote] = useState(initialNote);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const prior = Math.max(0, Math.floor(Number(units) || 0));
  const total = websiteSales + prior;

  function save() {
    setMsg(null);
    start(async () => {
      const res = await setPriorSales(productId, { units, note });
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Saved." : "Error.") });
      if (res.ok) router.refresh();
    });
  }

  return (
    <section className="card max-w-2xl p-5">
      <h2 className="font-medium">Sales history</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="label">Sold on the website</p>
          <p className="py-2 text-lg">{websiteSales}</p>
          <p className="text-xs text-ink-muted">Counted automatically from orders.</p>
        </div>
        <div>
          <label className="label" htmlFor="prior-units">
            Sold before the website
          </label>
          <input id="prior-units" type="number" min={0} value={units} onChange={(e) => setUnits(e.target.value)} className="input w-40" />
          <p className="mt-1 text-xs text-ink-muted">In store, WhatsApp, Daraz or anywhere else, from your sales records.</p>
        </div>
      </div>
      <div className="mt-4">
        <label className="label" htmlFor="prior-note">
          Note (optional, admin only)
        </label>
        <input
          id="prior-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="e.g. From the 2024–25 shop sales register"
          className="input"
        />
      </div>
      <p className="mt-4 text-sm">
        Shoppers see <strong>{total} sold</strong>
        {total < minSoldToShow && (
          <span className="text-ink-muted"> once it reaches {minSoldToShow} (Admin → Reviews → Display settings); hidden for now</span>
        )}
        .
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save sales history"}
        </button>
        {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-sale"}`}>{msg.text}</p>}
      </div>
    </section>
  );
}
