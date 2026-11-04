"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBundleToCart } from "@/app/actions/bundles";
import { cn } from "@/lib/utils";
import { swatchFor } from "@/lib/colors";
import { formatMoney } from "@/lib/money";
import { bundleSaving, colourKey } from "@/lib/bundle-rule";
import { trackItems, type AnalyticsItem } from "@/lib/analytics/track";
import type { BundleOffer, VariantOption } from "./AddToCart";

/**
 * Product page → "Colour bundle": tick at least `minColours` colours (one of each, in the chosen size) and
 * add them to the bag together at `percentOff` off. Shown only on products with enough colours in stock.
 * The bag works the saving out again (lib/bundle-rule.ts), so colours added one by one get it too.
 */
export function ColourBundle({
  variants,
  size,
  needsSize,
  offer,
  analyticsItem,
}: {
  variants: VariantOption[];
  size: string | null;
  needsSize: boolean;
  offer: BundleOffer;
  analyticsItem?: AnalyticsItem;
}) {
  const { config, productPriceCents, currency } = offer;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // One choice per colour: the variant in the chosen size (or the only size).
  const choices = useMemo(() => {
    const seen = new Map<string, VariantOption & { color: string }>();
    for (const v of variants) {
      if (!v.color?.trim() || (needsSize && v.size !== size)) continue;
      const k = colourKey(v.color);
      const have = seen.get(k);
      if (!have || (have.stock <= 0 && v.stock > 0)) seen.set(k, { ...v, color: v.color });
    }
    return [...seen.values()];
  }, [variants, size, needsSize]);

  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const chosen = choices.filter((c) => picked.has(colourKey(c.color)) && c.stock > 0);
  const price = (v: VariantOption) => v.priceCents ?? productPriceCents;
  const full = chosen.reduce((s, v) => s + price(v), 0);
  const enough = chosen.length >= config.minColours;
  const pay = full - (enough ? bundleSaving(full, config) : 0);
  const example = config.minColours * productPriceCents;

  function toggle(c: string) {
    setMessage(null);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(colourKey(c))) next.delete(colourKey(c));
      else next.add(colourKey(c));
      return next;
    });
  }

  function add() {
    setMessage(null);
    if (needsSize && !size) return setMessage({ ok: false, text: "Please select a size first." });
    if (!enough) return setMessage({ ok: false, text: `Choose at least ${config.minColours} colours.` });
    start(async () => {
      const res = await addBundleToCart(chosen.map((v) => v.id));
      setMessage({ ok: res.ok, text: res.message ?? (res.ok ? "Added to bag." : "Could not add the bundle.") });
      if (res.ok) {
        if (analyticsItem) {
          trackItems(
            "add_to_cart",
            chosen.map((v) => ({ ...analyticsItem, item_variant: [v.size, v.color].filter(Boolean).join(" / "), quantity: 1 })),
          );
        }
        setPicked(new Set());
        router.refresh();
      }
    });
  }

  return (
    <section className="border border-line p-4" aria-labelledby="colour-bundle-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="colour-bundle-title" className="text-sm font-semibold uppercase tracking-wide">
          Colour bundle
        </h2>
        <span className="text-sm font-medium text-sale">Save {config.percentOff}%</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Buy {config.minColours} or more colours of this design and save {config.percentOff}% on each.{" "}
        <span className="text-ink-muted">
          {config.minColours} for {formatMoney(example - bundleSaving(example, config), currency)} instead of{" "}
          {formatMoney(example, currency)}.
        </span>
      </p>

      {needsSize && !size ? (
        <p className="mt-3 text-sm text-ink-muted">Select a size above to choose your colours.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Colours in your bundle">
          {choices.map((c) => {
            const on = picked.has(colourKey(c.color));
            const out = c.stock <= 0;
            return (
              <button
                key={c.color}
                type="button"
                onClick={() => toggle(c.color)}
                disabled={out}
                aria-pressed={on}
                className={cn(
                  "flex items-center gap-2 border px-2.5 py-1.5 text-sm transition-colors",
                  on ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                  out && "cursor-not-allowed text-ink-muted line-through opacity-50",
                )}
              >
                <span
                  aria-hidden
                  className="h-4 w-4 shrink-0 rounded-full border border-line"
                  style={{ background: c.colorHex ?? swatchFor(c.color) ?? "#ddd" }}
                />
                {c.color}
                {on && <span aria-hidden>✓</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" aria-live="polite">
          {chosen.length === 0 ? (
            <span className="text-ink-muted">Tap the colours you want.</span>
          ) : enough ? (
            <>
              {chosen.length} colours: <span className="font-semibold text-sale">{formatMoney(pay, currency)}</span>{" "}
              <span className="text-ink-muted line-through">{formatMoney(full, currency)}</span>
            </>
          ) : (
            <span className="text-ink-muted">
              {chosen.length} chosen, add {config.minColours - chosen.length} more for {config.percentOff}% off.
            </span>
          )}
        </p>
        <button type="button" onClick={add} disabled={pending || !enough} className="btn-primary px-5">
          {pending ? "Adding…" : enough ? `Add ${chosen.length} to bag` : "Add bundle to bag"}
        </button>
      </div>

      {message && (
        <p className={cn("mt-2 text-sm", message.ok ? "text-success" : "text-sale")} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
