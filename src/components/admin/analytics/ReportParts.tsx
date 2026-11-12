import Link from "next/link";
import { cn } from "@/lib/utils";

/** Building blocks of Admin → Analytics (app/admin/analytics/page.tsx). */

const BAR = "#2a78d6";
/** Device segments: the first three slots of the validated categorical palette, always labelled. */
const SEGMENTS = ["#2a78d6", "#eb6834", "#1baf7a"];
const count = new Intl.NumberFormat("en-PK");

export function Panel({ title, note, children, className }: { title: string; note?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(17,17,17,0.04)]", className)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {note && <span className="text-xs text-ink-muted">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** Inside a panel that needs Google Analytics, until it's connected. */
export function NeedsGa({ what = "visitors" }: { what?: string }) {
  return (
    <p className="py-6 text-center text-sm text-ink-muted">
      Connect Google Analytics in{" "}
      <Link href="/admin/settings" className="underline">
        Settings
      </Link>{" "}
      to see {what} here.
    </p>
  );
}

/** Change against the previous period: ▲ / ▼ and the percentage; up is good unless `lowerIsBetter`. */
export function Delta({
  now,
  before,
  lowerIsBetter = false,
  points = false,
}: {
  now: number | null;
  before: number | null;
  lowerIsBetter?: boolean;
  /** for rates: the change in percentage points (0.18 → 0.21 = 3.0 pts) */
  points?: boolean;
}) {
  if (now === null || before === null) return null;
  const quiet = (text: string) => <span className="text-xs text-ink-muted">{text}</span>;
  let change: number;
  let text: string;
  if (points) {
    change = (now - before) * 100;
    if (Math.abs(change) < 0.05) return quiet("no change");
    text = `${Math.abs(change).toFixed(1)} pts`;
  } else {
    if (before === 0) return now === 0 ? quiet("no change") : quiet("new");
    change = ((now - before) / Math.abs(before)) * 100;
    if (Math.abs(change) < 0.5) return quiet("no change");
    text = `${Math.abs(change) >= 100 ? Math.round(Math.abs(change)) : Math.abs(change).toFixed(1)}%`;
  }
  const good = change > 0 !== lowerIsBetter;
  return (
    <span className={cn("whitespace-nowrap text-xs font-semibold", good ? "text-success" : "text-sale")}>
      <span aria-hidden>{change > 0 ? "▲" : "▼"}</span>
      <span className="sr-only">{change > 0 ? "up" : "down"}</span> {text}
    </span>
  );
}

/** A small line of the period, day by day, under a figure. One series, so no legend: the tile names it. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2 || values.every((v) => !v)) return <div className="h-8" />;
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const W = 200;
  const H = 32;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - min) / (max - min || 1)) * (H - 4)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-8 w-full" role="img" aria-label={label}>
      <polyline points={pts.join(" ")} fill="none" stroke={BAR} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** A headline figure, as at the top of Shopify's Analytics. */
export function KpiTile({
  label,
  value,
  now,
  before,
  hint,
  lowerIsBetter,
  points,
  spark,
}: {
  label: string;
  value: string;
  now?: number | null;
  before?: number | null;
  hint?: string;
  lowerIsBetter?: boolean;
  points?: boolean;
  spark?: number[];
}) {
  return (
    <div className="card flex flex-col p-4">
      <p className="text-[13px] font-medium text-ink-soft">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink">{value}</p>
      <div className="mt-1 flex min-h-4 flex-wrap items-center gap-x-2">
        {now !== undefined && before !== undefined && <Delta now={now} before={before} lowerIsBetter={lowerIsBetter} points={points} />}
        {hint && <span className="text-xs text-ink-muted">{hint}</span>}
      </div>
      {spark && (
        <div className="mt-auto pt-3">
          <Sparkline values={spark} label={`${label}, day by day`} />
        </div>
      )}
    </div>
  );
}

export function StatTile(props: { label: string; value: string; now?: number | null; before?: number | null; hint?: string; lowerIsBetter?: boolean }) {
  return <KpiTile {...props} />;
}

/** "This period / Change" table: the sales breakdown. */
export function ChangeTable({
  rows,
  format,
}: {
  rows: { label: string; now: number; before: number; lowerIsBetter?: boolean; total?: boolean; negative?: boolean }[];
  format: (v: number) => string;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-muted">
          <th className="pb-2 text-left font-medium">
            <span className="sr-only">Line</span>
          </th>
          <th className="pb-2 text-right font-medium">This period</th>
          <th className="w-24 pb-2 text-right font-medium">Change</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className={cn("border-b border-line-soft last:border-0", r.total && "border-t border-line font-semibold")}>
            <td className="py-2.5 pr-3">{r.label}</td>
            <td className="py-2.5 text-right tabular-nums">{r.negative && r.now ? `−${format(r.now)}` : format(r.now)}</td>
            <td className="py-2.5 text-right">
              <Delta now={r.now} before={r.before} lowerIsBetter={r.lowerIsBetter} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A ranked list with a bar for each value and its share of the total (one hue: magnitude, not identity). */
export function BarList({
  rows,
  format = (v) => count.format(v),
  empty = "No data for this period yet.",
  link,
  share = true,
}: {
  rows: { name: string; value: number; extra?: string }[];
  format?: (v: number) => string;
  empty?: string;
  link?: (name: string) => string | null;
  share?: boolean;
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-ink-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const href = link?.(r.name);
        return (
          <li key={r.name} title={`${r.name}: ${format(r.value)}`}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {href ? (
                  <Link href={href} className="hover:underline">
                    {r.name}
                  </Link>
                ) : (
                  r.name
                )}
                {r.extra && <span className="text-ink-muted"> · {r.extra}</span>}
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold">{format(r.value)}</span>
                {share && total > 0 && <span className="ml-1.5 inline-block w-11 text-right text-xs text-ink-muted">{((r.value / total) * 100).toFixed(1)}%</span>}
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-line-soft">
              <div className="h-2 rounded-full" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: BAR }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** One whole split into parts (e.g. sessions by device): a thin bar and a legend with the numbers. */
export function SplitBar({ rows }: { rows: { name: string; value: number }[] }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) return <p className="py-6 text-center text-sm text-ink-muted">No data for this period yet.</p>;
  const parts = rows.slice(0, 3);
  const other = rows.slice(3).reduce((s, r) => s + r.value, 0);
  const shown = other ? [...parts, { name: "Other", value: other }] : parts;
  const color = (i: number) => SEGMENTS[i] ?? "#b3b1aa";
  return (
    <div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={shown.map((r) => `${r.name} ${Math.round((r.value / total) * 100)}%`).join(", ")}>
        {shown.map((r, i) => (
          <div key={r.name} style={{ width: `${(r.value / total) * 100}%`, background: color(i) }} title={`${r.name}: ${count.format(r.value)}`} />
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {shown.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: color(i) }} />
            <span className="capitalize">{r.name}</span>
            <span className="ml-auto tabular-nums text-ink-soft">
              {count.format(r.value)} · {Math.round((r.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shopping funnel: how many got to each step, as a share of visitors and of the step before. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = steps[0]?.value ?? 0;
  if (!top) return <p className="py-6 text-center text-sm text-ink-muted">No visits recorded for this period yet.</p>;
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const share = s.value / top;
        const fromPrev = i ? (steps[i - 1].value ? s.value / steps[i - 1].value : 0) : null;
        return (
          <li key={s.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{s.label}</span>
              <span className="tabular-nums">
                <span className="font-semibold">{count.format(s.value)}</span>
                <span className="ml-2 text-ink-muted">{(share * 100).toFixed(1)}%</span>
              </span>
            </div>
            <div className="mt-1 h-3 rounded-sm bg-line-soft">
              <div className="h-3 rounded-sm" style={{ width: `${Math.max(1, share * 100)}%`, background: BAR }} />
            </div>
            {fromPrev !== null && <p className="mt-0.5 text-xs text-ink-muted">{(fromPrev * 100).toFixed(1)}% of the step before</p>}
          </li>
        );
      })}
    </ol>
  );
}

/** Shown where a source isn't connected yet. */
export function ConnectCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card border-dashed p-5">
      <p className="font-medium">{title}</p>
      <div className="mt-1 space-y-2 text-sm text-ink-muted">{children}</div>
      <Link href="/admin/settings" className="btn-secondary mt-4 inline-block">
        Open settings
      </Link>
    </div>
  );
}

export function SourceError({ source, message, saved }: { source: string; message: string; saved?: boolean }) {
  return (
    <div className="border border-sale/40 bg-sale/5 p-4 text-sm">
      <p className="font-medium text-sale">{source} figures couldn&apos;t be loaded{saved ? "; showing the last saved copy" : ""}</p>
      <p className="mt-1 text-ink-soft">{message}</p>
    </div>
  );
}
