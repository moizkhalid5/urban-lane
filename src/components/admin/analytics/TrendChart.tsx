"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Admin → Analytics: one measure over the days of a period, against the period before (same position, so
 * day 3 sits over day 3). Hover or arrow keys show both values for a day. One axis only.
 */
export type TrendPoint = { date: string; previousDate: string | null; current: number; previous: number };

const CURRENT = "#2a78d6";
const PREVIOUS = "#b3b1aa";
const GRID = "#ecebe7";
const H = 220;
const M = { top: 12, right: 12, bottom: 26, left: 52 };

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Rounded steps for the axis: 0, then 4 or 5 clean values above the highest point. */
function ticks(max: number) {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

export function TrendChart({
  points,
  unit,
  label,
  currentLabel = "This period",
  previousLabel = "Previous period",
}: {
  points: TrendPoint[];
  unit?: string;
  label: string;
  currentLabel?: string;
  previousLabel?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const money = (v: number) => (unit ? `${unit} ${full.format(v)}` : full.format(v));
  const tickText = (v: number) => (unit ? `${unit} ${v >= 10000 ? compact.format(v) : full.format(v)}` : v >= 10000 ? compact.format(v) : full.format(v));

  if (points.length < 2) {
    return <p className="py-10 text-center text-sm text-ink-muted">The trend shows for ranges of two days or more.</p>;
  }
  if (points.every((p) => !p.current && !p.previous)) {
    return <p className="py-10 text-center text-sm text-ink-muted">Nothing recorded in this period or the one before yet.</p>;
  }

  const yTicks = ticks(Math.max(...points.flatMap((p) => [p.current, p.previous])));
  const yMax = yTicks[yTicks.length - 1];
  const iw = width - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (i: number) => M.left + (i / (points.length - 1)) * iw;
  const y = (v: number) => M.top + ih - (v / yMax) * ih;
  const line = (key: "current" | "previous") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
  const area = `${line("current")}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const xLabels = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  const pick = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1));
    setActive(Math.max(0, Math.min(points.length - 1, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((a) => Math.max(0, Math.min(points.length - 1, (a ?? points.length - 1) + (e.key === "ArrowRight" ? 1 : -1))));
  };
  const a = active === null ? null : points[active];
  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active) - 80, 0), width - 170);

  return (
    <div ref={box} className="relative">
      <div className="mb-3 flex gap-5 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: CURRENT }} /> {currentLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: PREVIOUS }} /> {previousLabel}
        </span>
      </div>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-muted text-[11px] tabular-nums">
              {tickText(t)}
            </text>
          </g>
        ))}
        {xLabels.map((i, k) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}
            className="fill-ink-muted text-[11px]"
          >
            {day(points[i].date)}
          </text>
        ))}
        <path d={area} fill={CURRENT} fillOpacity={0.1} />
        <path d={line("previous")} fill="none" stroke={PREVIOUS} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={line("current")} fill="none" stroke={CURRENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {a && active !== null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + ih} stroke="#8a8984" strokeWidth={1} />
            <circle cx={x(active)} cy={y(a.previous)} r={4} fill={PREVIOUS} stroke="#fff" strokeWidth={2} />
            <circle cx={x(active)} cy={y(a.current)} r={4.5} fill={CURRENT} stroke="#fff" strokeWidth={2} />
          </g>
        )}
        <rect
          x={M.left}
          y={M.top}
          width={iw}
          height={ih}
          fill="transparent"
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setActive(null)}
        />
      </svg>
      {a && (
        <div
          className="pointer-events-none absolute top-8 w-[170px] rounded border border-line bg-white p-2.5 text-xs shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
          style={{ left: tipLeft }}
        >
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded" style={{ background: CURRENT }} />
            <span className="font-semibold text-ink">{money(a.current)}</span>
            <span className="ml-auto text-ink-muted">{day(a.date)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-0.5 w-3 rounded" style={{ background: PREVIOUS }} />
            <span className="font-medium text-ink-soft">{money(a.previous)}</span>
            <span className="ml-auto text-ink-muted">{a.previousDate ? day(a.previousDate) : "—"}</span>
          </div>
        </div>
      )}
      {/* The same figures as a table, for screen readers. */}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>{currentLabel}</th>
            <th>{previousLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{day(p.date)}</td>
              <td>{money(p.current)}</td>
              <td>{money(p.previous)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
