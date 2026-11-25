"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateMadeUpSales, removeMadeUpSales } from "@/app/actions/admin-manual-orders";

const day = (offsetDays: number) => new Date(Date.now() + 5 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** Admin → Orders → Made-up sales: add them, or remove them all. */
export function MadeUpSalesForm({ counts, existing }: { counts: { beauty: number; soldOut: number }; existing: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [beauty, setBeauty] = useState(counts.beauty > 0);
  const [soldOut, setSoldOut] = useState(counts.soldOut > 0);
  const [from, setFrom] = useState(day(-180));
  const [to, setTo] = useState(day(-1));
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(3);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setMsg(null);
    start(async () => {
      const res = await action();
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Done." : "Something went wrong.") });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="card max-w-2xl space-y-5 p-5">
        <h2 className="font-medium">Add made-up sales</h2>
        <fieldset className="space-y-2">
          <legend className="label">Products</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={beauty} onChange={(e) => setBeauty(e.target.checked)} />
            Make-up (all Beauty products): {counts.beauty}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={soldOut} onChange={(e) => setSoldOut(e.target.checked)} />
            Sold-out products (no pieces left): {counts.soldOut}
          </label>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="mu-from">From</label>
            <input id="mu-from" type="date" value={from} max={day(0)} onChange={(e) => setFrom(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="mu-to">To</label>
            <input id="mu-to" type="date" value={to} max={day(0)} onChange={(e) => setTo(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="mu-min">Pieces of each product: at least</label>
            <input id="mu-min" type="number" min={1} max={20} value={min} onChange={(e) => setMin(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="mu-max">at most</label>
            <input id="mu-max" type="number" min={1} max={20} value={max} onChange={(e) => setMax(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} className="input" />
          </div>
        </div>
        <p className="text-xs text-ink-muted">
          Each product gets a random number of pieces in that range, sold in orders of 1–3 products at random times between the two dates,
          paid and delivered, at today&apos;s shop prices. Clicking again adds more.
        </p>
        {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-sale"}`} role="status">{msg.text}</p>}
        <button
          type="button"
          disabled={pending || (!beauty && !soldOut)}
          onClick={() => run(() => generateMadeUpSales({ beauty, soldOut, from, to, min, max }))}
          className="btn-primary"
        >
          {pending ? "Working…" : "Add made-up sales"}
        </button>
      </section>

      {existing > 0 && (
        <section className="card max-w-2xl space-y-3 border-sale/40 p-5">
          <h2 className="font-medium">Remove them</h2>
          <p className="text-sm text-ink-soft">Deletes all {existing} made-up orders. Real orders are not touched.</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => window.confirm(`Delete all ${existing} made-up orders? Real orders stay.`) && run(removeMadeUpSales)}
            className="btn-secondary border-sale text-sale"
          >
            Remove all made-up sales
          </button>
        </section>
      )}
    </div>
  );
}
