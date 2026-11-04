"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBundleSettings } from "@/app/actions/bundles";
import type { BundleConfig } from "@/lib/bundle-rule";

/** Admin → Settings: colour bundles (3+ colours of one design at a lower price). */
export function BundleForm({ initial }: { initial: BundleConfig }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [minColours, setMin] = useState(String(initial.minColours));
  const [percentOff, setPct] = useState(String(initial.percentOff));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const n = Number(minColours) || 3;
  const pct = Number(percentOff) || 0;
  const example = Math.round(n * 2000 * (1 - pct / 100));

  return (
    <section className="card max-w-2xl p-5">
      <h2 className="font-medium">Colour bundles</h2>
      <p className="mt-1 text-sm text-ink-muted">
        When a shopper buys several different colours of the same product, those items cost less. Products that
        come in enough colours show a &ldquo;Colour bundle&rdquo; box, and the saving appears in the bag and at checkout.
      </p>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-ink" />
        Offer colour bundles
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        Buy at least
        <input type="number" min={2} max={10} value={minColours} onChange={(e) => setMin(e.target.value)} className="input w-20" disabled={!enabled} />
        different colours, get
        <input type="number" min={1} max={90} value={percentOff} onChange={(e) => setPct(e.target.value)} className="input w-20" disabled={!enabled} />
        % off them.
      </div>
      {enabled && pct > 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          Example: a Rs 2,000 T-shirt in {n} colours costs Rs {example.toLocaleString("en-PK")} instead of Rs{" "}
          {(n * 2000).toLocaleString("en-PK")}. Fewer than {n} colours pay the normal price.
        </p>
      )}
      <div className="mt-4 flex items-center gap-3 text-sm">
        <button
          type="button"
          disabled={pending}
          className="btn-primary"
          onClick={() =>
            start(async () => {
              const res = await setBundleSettings({ enabled, minColours, percentOff });
              setMsg({ ok: res.ok, text: res.message ?? "" });
              if (res.ok) router.refresh();
            })
          }
        >
          {pending ? "Saving…" : "Save bundles"}
        </button>
        {msg && <span className={msg.ok ? "text-success" : "text-sale"}>{msg.text}</span>}
      </div>
    </section>
  );
}
