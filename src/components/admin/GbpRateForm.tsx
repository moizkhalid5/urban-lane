"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setGbpToPkr } from "@/app/actions/uk-price";

/** Admin → Settings: rupees per pound used to show UK prices ("UK price Rs X · Save Y%"). */
export function GbpRateForm({ initial }: { initial: number }) {
  const router = useRouter();
  const [rate, setRate] = useState(String(initial));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <section className="card max-w-2xl p-5">
      <h2 className="font-medium">UK price comparison</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Products with a UK price (set on each product) show &ldquo;UK price Rs X · Save Y%&rdquo; when ours is lower.
        The pound price is converted at this rate and rounded to the nearest Rs 100.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        Rs
        <input type="number" min={50} step="1" value={rate} onChange={(e) => setRate(e.target.value)} className="input w-28" />
        per £1
        <button
          type="button"
          disabled={pending}
          className="btn-primary ml-2"
          onClick={() =>
            start(async () => {
              const res = await setGbpToPkr({ gbpToPkr: rate });
              setMsg({ ok: res.ok, text: res.message ?? "" });
              if (res.ok) router.refresh();
            })
          }
        >
          {pending ? "Saving…" : "Save rate"}
        </button>
        {msg && <span className={msg.ok ? "text-success" : "text-sale"}>{msg.text}</span>}
      </div>
    </section>
  );
}
