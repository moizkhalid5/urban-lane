"use client";

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import {
  PALETTE,
  SEQUENTIAL,
  FUNNEL_RAMP,
  textOn,
} from "@/components/admin/analytics/palette";

/**
 * Admin → Analytics charts that respond to the pointer: donut, waterfall, columns, weekday × hour heatmap,
 * treemap, funnel and gauge. Every value is also shown in a legend, label or screen-reader table; the tooltip
 * only adds detail. Hand-made SVG/HTML, no chart library.
 */

const count = new Intl.NumberFormat("en-PK");
const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Amounts are passed in minor units with the shop's currency (plain data: a server page can't hand a
 * formatting function to these browser components); counts without a currency.
 */
const formatter = (currency?: DisplayCurrency) =>
  currency ? (v: number) => formatMoney(v, currency) : (v: number) => count.format(v);
const shortFormatter = (currency?: DisplayCurrency) =>
  currency
    ? (v: number) =>
        `${currency.symbol}${currency.symbol.length > 1 ? " " : ""}${compact.format((v / 100) * currency.rate)}`
    : (v: number) => compact.format(v);

/* ---------- tooltip ---------- */

type Tip = { x: number; y: number; node: ReactNode };

function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const place = (e: PointerEvent | FocusEvent, node: ReactNode) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    if ("clientX" in e) setTip({ x: e.clientX - box.left, y: e.clientY - box.top, node });
    else {
      const r = (e.target as Element).getBoundingClientRect();
      setTip({ x: r.left + r.width / 2 - box.left, y: r.top - box.top, node });
    }
  };
  const bind = (node: ReactNode, focusable = true) => ({
    onPointerEnter: (e: PointerEvent) => place(e, node),
    onPointerMove: (e: PointerEvent) => place(e, node),
    onPointerLeave: () => setTip(null),
    onFocus: (e: FocusEvent) => place(e, node),
    onBlur: () => setTip(null),
    ...(focusable ? { tabIndex: 0 } : {}),
  });
  const width = ref.current?.clientWidth ?? 0;
  const el = tip ? (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 max-w-[240px] rounded-md border border-line bg-white px-3 py-2 text-xs shadow-[0_6px_20px_rgba(17,17,17,0.12)]"
      style={{
        left: Math.min(Math.max(tip.x, 90), Math.max(90, width - 90)),
        top: tip.y - 10,
        transform: "translate(-50%, -100%)",
      }}
    >
      {tip.node}
    </div>
  ) : null;
  return { ref, bind, el, active: tip };
}

const TipRow = ({
  color,
  label,
  value,
}: {
  color?: string;
  label: ReactNode;
  value: ReactNode;
}) => (
  <div className="flex items-center gap-2 whitespace-nowrap">
    {color && (
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
    )}
    <span className="text-ink-soft">{label}</span>
    <span className="ml-auto pl-3 font-semibold text-ink">{value}</span>
  </div>
);

const Empty = ({
  children = "No data for this period yet.",
}: {
  children?: ReactNode;
}) => <p className="py-10 text-center text-sm text-ink-muted">{children}</p>;

/** Width of a box, kept up to date. */
function useWidth<T extends HTMLElement>(initial = 600) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setW(Math.max(200, Math.round(e.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ---------- donut ---------- */

export type Slice = { name: string; value: number; color: string; extra?: string };

function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) =>
    `${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(r1, a0)}A${r1},${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
}

/** Part of a whole, up to 4 named parts plus "Other"; the legend carries every value and share. */
export function Donut({
  rows,
  currency,
  centerLabel,
  centerValue,
  label,
}: {
  rows: Slice[];
  currency?: DisplayCurrency;
  centerLabel: string;
  centerValue?: string;
  label: string;
}) {
  const format = formatter(currency);
  const short = shortFormatter(currency);
  const { ref, bind, el } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) return <Empty />;
  const S = 200;
  const R1 = 92;
  const R0 = 64;
  const gap = rows.filter((r) => r.value > 0).length > 1 ? 2 / R1 : 0; // 2px surface gap between slices
  let a = 0;
  const arcs = rows.map((r, i) => {
    const sweep = (r.value / total) * Math.PI * 2;
    const a0 = a + gap / 2;
    const a1 = Math.min(a + sweep - gap / 2, a0 + Math.PI * 2 - 0.0001);
    a += sweep;
    return { r, i, a0, a1, sweep };
  });
  const shown = hover === null ? null : rows[hover];

  return (
    <div ref={ref} className="relative flex flex-col items-center gap-5">
      <svg
        viewBox={`0 0 ${S} ${S}`}
        className="h-44 w-44 shrink-0"
        role="img"
        aria-label={label}
      >
        {arcs.map(({ r, i, a0, a1, sweep }) =>
          sweep > 0 ? (
            <path
              key={r.name}
              d={arcPath(S / 2, S / 2, R0, hover === i ? R1 + 5 : R1, a0, a1)}
              fill={r.color}
              opacity={hover === null || hover === i ? 1 : 0.35}
              className="cursor-pointer outline-none transition-[opacity] duration-150"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              {...bind(
                <TipRow
                  color={r.color}
                  label={r.name}
                  value={`${format(r.value)} · ${((r.value / total) * 100).toFixed(1)}%`}
                />,
              )}
            />
          ) : null,
        )}
        <text
          x={S / 2}
          y={S / 2 - 6}
          textAnchor="middle"
          className="fill-ink text-[22px] font-bold"
        >
          {shown
            ? `${((shown.value / total) * 100).toFixed(0)}%`
            : (centerValue ?? short(total))}
        </text>
        <text
          x={S / 2}
          y={S / 2 + 16}
          textAnchor="middle"
          className="fill-ink-muted text-[11px]"
        >
          {shown ? shown.name : centerLabel}
        </text>
      </svg>
      <ul className="w-full min-w-0 space-y-2.5 text-sm">
        {rows.map((r, i) => (
          <li
            key={r.name}
            className="flex items-center gap-2.5"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: r.color }}
            />
            <span className="min-w-0 truncate">{r.name}</span>
            <span className="ml-auto shrink-0 text-right tabular-nums">
              <span className="font-semibold">{format(r.value)}</span>
              <span className="ml-1.5 inline-block w-11 text-xs text-ink-muted">
                {((r.value / total) * 100).toFixed(1)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
      {el}
    </div>
  );
}

/* ---------- waterfall ---------- */

export type Step = { label: string; value: number; kind: "add" | "subtract" | "total" };

/** How the parts add up to a total: each bar starts where the one before ended. */
export function Waterfall({
  steps,
  currency,
}: {
  steps: Step[];
  currency: DisplayCurrency;
}) {
  const format = formatter(currency);
  const short = shortFormatter(currency);
  const { ref, bind, el } = useTip();
  const [box, width] = useWidth<HTMLDivElement>();
  if (!steps.some((s) => s.value)) return <Empty>No sales in this period.</Empty>;
  let run = 0;
  const bars = steps.map((s) => {
    const from = s.kind === "total" ? 0 : run;
    const to =
      s.kind === "total" ? s.value : s.kind === "add" ? run + s.value : run - s.value;
    if (s.kind !== "total") run = to;
    return { ...s, lo: Math.min(from, to), hi: Math.max(from, to), end: to };
  });
  const max = Math.max(...bars.map((b) => b.hi), 1);
  const H = 210;
  const top = 22;
  const bottom = 34;
  const ih = H - top - bottom;
  const slot = width / bars.length;
  const bw = Math.min(64, slot * 0.56);
  const y = (v: number) => top + ih - (v / max) * ih;
  const color = (k: Step["kind"]) =>
    k === "add" ? PALETTE.blue : k === "subtract" ? PALETTE.red : PALETTE.ink;

  return (
    <div ref={ref} className="relative">
      <div ref={box}>
        <svg
          width={width}
          height={H}
          role="img"
          aria-label="Sales breakdown, from gross sales to total sales"
          className="block"
        >
          <line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke={PALETTE.axis} />
          {bars.map((b, i) => {
            const cx = slot * i + slot / 2;
            const h = Math.max(2, y(b.lo) - y(b.hi));
            return (
              <g key={b.label}>
                {i < bars.length - 1 && bars[i + 1].kind !== "total" && (
                  <line
                    x1={cx + bw / 2}
                    x2={cx + slot - bw / 2}
                    y1={y(b.end)}
                    y2={y(b.end)}
                    stroke={PALETTE.axis}
                  />
                )}
                <rect
                  x={cx - bw / 2}
                  y={y(b.hi)}
                  width={bw}
                  height={h}
                  rx={4}
                  fill={color(b.kind)}
                  className="outline-none"
                  {...bind(
                    <TipRow
                      color={color(b.kind)}
                      label={b.label}
                      value={`${b.kind === "subtract" ? "−" : ""}${format(b.value)}`}
                    />,
                  )}
                />
                <text
                  x={cx}
                  y={y(b.hi) - 7}
                  textAnchor="middle"
                  className="fill-ink text-[11px] font-semibold"
                >
                  {b.kind === "subtract" && b.value ? "−" : ""}
                  {slot < 110 ? short(b.value) : format(b.value)}
                </text>
                <text
                  x={cx}
                  y={H - 12}
                  textAnchor="middle"
                  className="fill-ink-muted text-[11px]"
                >
                  {b.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-muted">
        <Key color={PALETTE.blue}>Adds to sales</Key>
        <Key color={PALETTE.red}>Taken off</Key>
        <Key color={PALETTE.ink}>Total</Key>
      </div>
      {el}
    </div>
  );
}

const Key = ({ color, children }: { color: string; children: ReactNode }) => (
  <span className="flex items-center gap-1.5">
    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
    {children}
  </span>
);

/* ---------- columns ---------- */

/** Vertical bars for a handful of named values (e.g. sales by city). One measure, one colour. */
export function Columns({
  rows,
  currency,
  color = PALETTE.blue,
  label,
}: {
  rows: { name: string; value: number; extra?: string }[];
  currency?: DisplayCurrency;
  color?: string;
  label: string;
}) {
  const format = formatter(currency);
  const axis = shortFormatter(currency);
  const { ref, bind, el } = useTip();
  if (!rows.length) return <Empty>No orders in this period.</Empty>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  return (
    <div ref={ref} className="relative" role="img" aria-label={label}>
      <div className="relative h-52 pl-12">
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute left-12 right-0 border-t border-line-soft"
            style={{ bottom: `${(t / max) * 100}%` }}
          >
            <span className="absolute -left-12 -top-2 w-10 text-right text-[11px] tabular-nums text-ink-muted">
              {axis(t)}
            </span>
          </div>
        ))}
        <div className="relative flex h-full items-end gap-[6%]">
          {rows.map((r) => (
            <div key={r.name} className="flex h-full flex-1 items-end justify-center">
              <div
                className="w-full max-w-[72px] cursor-pointer rounded-t-[4px] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ink/30"
                style={{
                  height: `${Math.max(1.5, (r.value / max) * 100)}%`,
                  background: color,
                }}
                {...bind(
                  <div className="space-y-1">
                    <p className="font-semibold text-ink">{r.name}</p>
                    <TipRow color={color} label="Sales" value={format(r.value)} />
                    {r.extra && <p className="text-ink-muted">{r.extra}</p>}
                  </div>,
                )}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-[6%] pl-12">
        {rows.map((r) => (
          <p
            key={r.name}
            className="flex-1 truncate text-center text-[11px] text-ink-muted"
            title={r.name}
          >
            {r.name}
          </p>
        ))}
      </div>
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <th>{r.name}</th>
                <td>{format(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {el}
    </div>
  );
}

/* ---------- weekday × hour heatmap ---------- */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hourName = (h: number) =>
  h === 0 ? "12 am" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`;

/** When orders come in: one cell per weekday and hour, darker = more orders (one hue, light → dark). */
export function HourHeatmap({ grid }: { grid: number[][] }) {
  const { ref, bind, el } = useTip();
  const max = Math.max(...grid.flat());
  if (!max) return <Empty>No orders in this period.</Empty>;
  const step = (v: number) =>
    v
      ? SEQUENTIAL[
          Math.min(
            SEQUENTIAL.length - 1,
            Math.floor((v / max) * SEQUENTIAL.length - 1e-9),
          )
        ]
      : PALETTE.empty;
  const busiest = grid
    .flatMap((row, d) => row.map((v, h) => ({ d, h, v })))
    .sort((a, b) => b.v - a.v)[0];
  const byDay = grid.map((r) => r.reduce((s, v) => s + v, 0));
  const topDay = byDay.indexOf(Math.max(...byDay));

  return (
    <div ref={ref} className="relative">
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[2px]">
            {grid.map((row, d) => (
              <div key={d} className="contents">
                <span className="pr-2 text-right text-[11px] leading-[22px] text-ink-muted">
                  {DAYS[d]}
                </span>
                {row.map((v, h) => (
                  <span
                    key={h}
                    className="h-[22px] cursor-default rounded-[3px] outline-none hover:ring-2 hover:ring-ink/40"
                    style={{ background: step(v) }}
                    {...bind(
                      <TipRow
                        label={`${DAYS[d]}, ${hourName(h)}–${hourName((h + 1) % 24)}`}
                        value={`${v} ${v === 1 ? "order" : "orders"}`}
                      />,
                      false,
                    )}
                  />
                ))}
              </div>
            ))}
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="pt-1 text-center text-[10px] text-ink-muted">
                {h % 3 === 0 ? hourName(h).replace(" ", "") : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
        <p>
          Busiest:{" "}
          <span className="font-semibold text-ink">
            {DAYS[busiest.d]}s around {hourName(busiest.h)}
          </span>{" "}
          · best day <span className="font-semibold text-ink">{DAYS[topDay]}</span>
        </p>
        <span className="flex items-center gap-1">
          Fewer
          {[PALETTE.empty, ...SEQUENTIAL].map((c) => (
            <span key={c} className="h-3 w-3 rounded-[2px]" style={{ background: c }} />
          ))}
          More
        </span>
      </div>
      <div className="sr-only">
        <table>
          <caption>Orders by weekday and hour</caption>
          <tbody>
            {grid.map((row, d) => (
              <tr key={d}>
                <th>{DAYS[d]}</th>
                {row.map((v, h) => (
                  <td key={h}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {el}
    </div>
  );
}

/* ---------- treemap ---------- */

export type TreeItem = { name: string; value: number; group: string; extra?: string };
type Rect = { x: number; y: number; w: number; h: number };

/** Squarified treemap: areas proportional to value, tiles as close to square as possible. */
function squarify(values: number[], box: Rect): Rect[] {
  const total = values.reduce((s, v) => s + v, 0);
  const areas = values.map((v) => (v / total) * box.w * box.h);
  const out: Rect[] = [];
  let { x, y, w, h } = box;
  let row: number[] = [];
  const worst = (r: number[], len: number) => {
    const s = r.reduce((a, b) => a + b, 0);
    return Math.max(
      (len * len * Math.max(...r)) / (s * s),
      (s * s) / (len * len * Math.min(...r)),
    );
  };
  const place = (r: number[]) => {
    const s = r.reduce((a, b) => a + b, 0);
    if (w >= h) {
      const cw = s / h;
      let cy = y;
      for (const a of r) {
        out.push({ x, y: cy, w: cw, h: a / cw });
        cy += a / cw;
      }
      x += cw;
      w -= cw;
    } else {
      const rh = s / w;
      let cx = x;
      for (const a of r) {
        out.push({ x: cx, y, w: a / rh, h: rh });
        cx += a / rh;
      }
      y += rh;
      h -= rh;
    }
  };
  const rest = [...areas];
  while (rest.length) {
    const len = Math.min(w, h);
    if (!row.length || worst([...row, rest[0]], len) <= worst(row, len))
      row.push(rest.shift()!);
    else {
      place(row);
      row = [];
    }
  }
  if (row.length) place(row);
  return out;
}

/** Sales by category as areas, coloured by department (legend below). */
export function Treemap({
  items,
  groups,
  currency,
}: {
  items: TreeItem[];
  groups: { name: string; color: string }[];
  currency?: DisplayCurrency;
}) {
  const format = formatter(currency);
  const { ref, bind, el } = useTip();
  const [box, width] = useWidth<HTMLDivElement>();
  const rows = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  if (!rows.length) return <Empty>No orders in this period.</Empty>;
  const H = 260;
  const rects = squarify(
    rows.map((r) => r.value),
    { x: 0, y: 0, w: width, h: H },
  );
  const total = rows.reduce((s, r) => s + r.value, 0);
  const colorOf = (g: string) => groups.find((x) => x.name === g)?.color ?? PALETTE.other;
  const usedGroups = groups.filter((g) => rows.some((r) => r.group === g.name));
  const hasOther = rows.some((r) => !groups.some((g) => g.name === r.group));

  return (
    <div ref={ref} className="relative">
      <div
        ref={box}
        className="relative"
        style={{ height: H }}
        role="img"
        aria-label="Sales by category"
      >
        {rows.map((r, i) => {
          const q = rects[i];
          const c = colorOf(r.group);
          const roomy = q.w > 84 && q.h > 40;
          return (
            <div
              key={r.name}
              className="absolute cursor-default overflow-hidden rounded-[4px] p-2 outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ink/40"
              style={{
                left: q.x + 1,
                top: q.y + 1,
                width: Math.max(0, q.w - 2),
                height: Math.max(0, q.h - 2),
                background: c,
                color: textOn(c),
              }}
              {...bind(
                <div className="space-y-1">
                  <p className="font-semibold text-ink">{r.name}</p>
                  <TipRow
                    color={c}
                    label="Sales"
                    value={`${format(r.value)} · ${((r.value / total) * 100).toFixed(1)}%`}
                  />
                  {r.extra && <p className="text-ink-muted">{r.extra}</p>}
                </div>,
              )}
            >
              {roomy && (
                <>
                  <p className="truncate text-xs font-semibold leading-tight">
                    {r.name.split(" · ").at(-1)}
                  </p>
                  {q.h > 56 && (
                    <p className="mt-0.5 truncate text-[11px] opacity-90">
                      {format(r.value)}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-muted">
        {usedGroups.map((g) => (
          <Key key={g.name} color={g.color}>
            {g.name}
          </Key>
        ))}
        {hasOther && <Key color={PALETTE.other}>Other</Key>}
      </div>
      <div className="sr-only">
        <table>
          <caption>Sales by category</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <th>{r.name}</th>
                <td>{format(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {el}
    </div>
  );
}

/* ---------- funnel ---------- */

/** Visit → order: each step narrows to the next one's width; ordered steps, one hue light → dark. */
export function FunnelChart({ steps }: { steps: { label: string; value: number }[] }) {
  const { ref, bind, el } = useTip();
  const top = steps[0]?.value ?? 0;
  if (!top) return <Empty>No visits recorded for this period yet.</Empty>;
  return (
    <div ref={ref} className="relative">
      <ol className="space-y-1.5">
        {steps.map((s, i) => {
          const share = s.value / top;
          const next = steps[i + 1]?.value ?? s.value;
          const inset = s.value ? ((1 - Math.min(1, next / s.value)) / 2) * 100 : 0;
          const fromPrev = i
            ? steps[i - 1].value
              ? s.value / steps[i - 1].value
              : 0
            : null;
          const color = FUNNEL_RAMP[Math.min(i, FUNNEL_RAMP.length - 1)];
          return (
            <li
              key={s.label}
              className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-3 text-sm"
            >
              <span className="truncate text-ink-soft">{s.label}</span>
              <div className="flex h-10 justify-center">
                <div
                  className="h-full outline-none"
                  style={{
                    width: `${Math.max(2, share * 100)}%`,
                    background: color,
                    clipPath:
                      i < steps.length - 1
                        ? `polygon(0 0, 100% 0, ${100 - inset}% 100%, ${inset}% 100%)`
                        : undefined,
                    borderRadius: i === steps.length - 1 ? 4 : undefined,
                  }}
                  {...bind(
                    <div className="space-y-1">
                      <TipRow
                        color={color}
                        label={s.label}
                        value={count.format(s.value)}
                      />
                      <p className="text-ink-muted">
                        {(share * 100).toFixed(1)}% of visitors
                        {fromPrev !== null
                          ? ` · ${(fromPrev * 100).toFixed(1)}% of the step before`
                          : ""}
                      </p>
                    </div>,
                  )}
                />
              </div>
              <span className="text-right tabular-nums">
                <span className="font-semibold">{compact.format(s.value)}</span>
                <span className="block text-[11px] text-ink-muted">
                  {(share * 100).toFixed(1)}%
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {el}
    </div>
  );
}

/* ---------- gauge ---------- */

/** One rate out of 100%, as a half ring. */
export function Gauge({
  value,
  label,
  color = PALETTE.blue,
  note,
}: {
  value: number | null;
  label: string;
  color?: string;
  note?: string;
}) {
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  const R = 80;
  const C = Math.PI * R;
  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 116"
        className="w-full max-w-[220px]"
        role="img"
        aria-label={`${label}: ${value === null ? "no data" : `${(v * 100).toFixed(1)}%`}`}
      >
        <path
          d="M20,100 A80,80 0 0 1 180,100"
          fill="none"
          stroke={PALETTE.empty}
          strokeWidth={16}
          strokeLinecap="round"
        />
        {value !== null && v > 0 && (
          <path
            d="M20,100 A80,80 0 0 1 180,100"
            fill="none"
            stroke={color}
            strokeWidth={16}
            strokeLinecap="round"
            strokeDasharray={`${C * v} ${C}`}
          />
        )}
        <text
          x={100}
          y={92}
          textAnchor="middle"
          className="fill-ink text-[26px] font-bold"
        >
          {value === null ? "—" : `${(v * 100).toFixed(1)}%`}
        </text>
      </svg>
      <p className="-mt-1 text-sm font-medium">{label}</p>
      {note && <p className="mt-0.5 text-center text-xs text-ink-muted">{note}</p>}
    </div>
  );
}
