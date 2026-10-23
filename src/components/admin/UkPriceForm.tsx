"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUkPrice } from "@/app/actions/uk-price";

const rupees = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;

/**
 * Admin product page: the product's real UK retail price. Shoppers see "UK price Rs X · Save Y%" when our
 * price is lower. Rounding (nearest Rs 100) and the saving are worked out the same way as on the shop
 * (lib/pricing/uk-price).
 */
export function UkPriceForm({
  productId,
  ourPrice,
  initialPounds,
  initialSource,
  gbpToPkr,
}: {
  productId: string;
  /** our price in rupees */
  ourPrice: number;
  initialPounds: string;
  initialSource: string;
  gbpToPkr: number;
}) {
  const router = useRouter();
  const [pounds, setPounds] = useState(initialPounds);
  const [source, setSource] = useState(initialSource);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const value = Number(pounds);
  const ukRupees = pounds && value > 0 ? Math.round((value * gbpToPkr) / 100) * 100 : 0;
  const save = ukRupees > ourPrice ? Math.floor(((ukRupees - ourPrice) / ukRupees) * 100) : 0;

  function save_() {
    setMsg(null);
    start(async () => {
      const res = await setUkPrice(productId, { pounds, source });
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Saved." : "Error.") });
      if (res.ok) router.refresh();
    });
  }

  return (
    <section className="card max-w-2xl p-5">
      <h2 className="font-medium">UK price comparison</h2>
      <p className="mt-1 text-sm text-ink-muted">
        This item&apos;s real retail price in the UK (from the brand&apos;s or a UK shop&apos;s website). Leave empty to show
        no comparison.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="uk-pounds">
            UK price (£)
          </label>
          <input id="uk-pounds" inputMode="decimal" value={pounds} onChange={(e) => setPounds(e.target.value)} placeholder="e.g. 48" className="input w-40" />
        </div>
        <div>
          <p className="label">Our price</p>
          <p className="py-2">{rupees(ourPrice)}</p>
        </div>
      </div>
      <div className="mt-4">
        <label className="label" htmlFor="uk-source">
          Where the UK price is from (optional, admin only)
        </label>
        <input id="uk-source" value={source} onChange={(e) => setSource(e.target.value)} maxLength={500} placeholder="e.g. riverisland.com product link" className="input" />
      </div>
      <p className="mt-4 text-sm">
        {!ukRupees ? (
          <span className="text-ink-muted">No comparison shown.</span>
        ) : save >= 1 ? (
          <>
            Shoppers see: <strong>UK price {rupees(ukRupees)} · Save {save}%</strong>{" "}
            <span className="text-ink-muted">
              (£{value} × Rs {gbpToPkr}, rounded to the nearest Rs 100; rate in Admin → Settings)
            </span>
          </>
        ) : (
          <span className="text-ink-muted">
            UK price {rupees(ukRupees)} isn&apos;t higher than ours, so no comparison is shown.
          </span>
        )}
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save_} disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save UK price"}
        </button>
        {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-sale"}`}>{msg.text}</p>}
      </div>
    </section>
  );
}
