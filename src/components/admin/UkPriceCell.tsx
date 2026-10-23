"use client";

import { useState, useTransition } from "react";
import { setUkPrice } from "@/app/actions/uk-price";

/**
 * Admin → Products list: quick edit of a product's UK price (£). Press Enter (or Save) to save; empty
 * removes it. Shows what shoppers will see, worked out like the shop (nearest Rs 100, saving rounded down).
 * The shop updates immediately; the list's filter counts update when the list is reloaded.
 */
export function UkPriceCell({
  productId,
  ourPrice,
  initialPounds,
  gbpToPkr,
}: {
  productId: string;
  ourPrice: number; // rupees
  initialPounds: string;
  gbpToPkr: number;
}) {
  const [value, setValue] = useState(initialPounds);
  const [saved, setSaved] = useState(initialPounds);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pounds = Number(saved);
  const uk = saved && pounds > 0 ? Math.round((pounds * gbpToPkr) / 100) * 100 : 0;
  const save = uk > ourPrice ? Math.floor(((uk - ourPrice) / uk) * 100) : 0;
  const dirty = value.trim() !== saved;

  function commit() {
    if (!dirty) return;
    setError(null);
    start(async () => {
      const res = await setUkPrice(productId, { pounds: value.trim(), quick: true });
      // No page refresh: in the "Missing UK price" view the row stays (with its result) until the list is
      // reloaded, so you can work down the list and see each saving.
      if (res.ok) setSaved(value.trim());
      else setError(res.message ?? "Couldn't save.");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <span className="text-ink-muted">£</span>
        <input
          aria-label="UK price in pounds"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setValue(saved);
          }}
          placeholder="—"
          className="w-20 border border-line px-2 py-1 text-right text-sm focus:border-ink focus:outline-none"
        />
        {dirty && (
          <button type="button" onClick={commit} disabled={pending} className="text-xs underline">
            {pending ? "…" : "Save"}
          </button>
        )}
      </div>
      <span className={`text-xs ${save >= 1 ? "font-medium text-sale" : "text-ink-muted"}`}>
        {error ? <span className="text-sale">{error}</span> : !uk ? "" : save >= 1 ? `Rs ${uk.toLocaleString("en-PK")} · Save ${save}%` : "No saving shown"}
      </span>
    </div>
  );
}
