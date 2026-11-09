"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TrendChart, type TrendPoint } from "@/components/admin/analytics/TrendChart";

/**
 * The big chart under the headline figures: one measure at a time (tabs), against the period before, or the
 * same figures as a table. A measure that isn't available yet (sessions before Google Analytics is connected)
 * shows as a dimmed tab that says why.
 */
export type ChartSeries = { key: string; tab: string; unit?: string; points: TrendPoint[]; unavailable?: string };

const full = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function ChartCard({ series, currentLabel, previousLabel }: { series: ChartSeries[]; currentLabel: string; previousLabel: string }) {
  const [active, setActive] = useState(series[0].key);
  const [asTable, setAsTable] = useState(false);
  const s = series.find((x) => x.key === active) ?? series[0];
  const fmt = (v: number) => (s.unit ? `${s.unit} ${full.format(v)}` : full.format(v));

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Measure">
          {series.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={x.key === s.key}
              disabled={!!x.unavailable}
              title={x.unavailable}
              onClick={() => setActive(x.key)}
              className={cn(
                "rounded px-3 py-1.5 text-sm transition-colors",
                x.key === s.key ? "bg-line-soft font-semibold text-ink" : "text-ink-soft hover:bg-line-soft",
                x.unavailable && "cursor-not-allowed text-ink-muted/60 hover:bg-transparent",
              )}
            >
              {x.tab}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setAsTable((t) => !t)} className="text-sm font-medium underline underline-offset-4">
          {asTable ? "Show as chart" : "Show as table"}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="py-2 font-medium">Day</th>
                <th className="py-2 text-right font-medium">{s.tab.replace(/ over time$/, "")}</th>
                <th className="py-2 text-right font-medium">Compared with</th>
                <th className="py-2 text-right font-medium">{s.tab.replace(/ over time$/, "")} then</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {s.points.map((p) => (
                <tr key={p.date}>
                  <td className="py-1.5">{day(p.date)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmt(p.current)}</td>
                  <td className="py-1.5 text-right text-ink-muted">{p.previousDate ? day(p.previousDate) : "—"}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink-soft">{p.previousDate ? fmt(p.previous) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <TrendChart key={s.key} label={`${s.tab}, per day`} unit={s.unit} points={s.points} currentLabel={currentLabel} previousLabel={previousLabel} />
      )}
    </section>
  );
}
