import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Activity, RecentOrder } from "@/lib/analytics/activity";
import { GRADIENTS, PALETTE, STATUS_STYLE } from "@/components/admin/analytics/palette";

/** Admin → Analytics, dashboard pieces that don't need the pointer (server-rendered). */

const count = new Intl.NumberFormat("en-PK");

/* ---------- icons (24 × 24, stroked) ---------- */

const ICONS = {
  sales: "M3 7h18v10H3z M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5 M6 10v4 M18 10v4",
  orders: "M6 8h12l-1 12H7L6 8z M9 8a3 3 0 0 1 6 0",
  aov: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6 M9 16h3",
  sessions:
    "M9 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6z M3 20a6 6 0 0 1 12 0 M16 5.3a3 3 0 0 1 0 5.4 M18 20a6 6 0 0 0-3-5.2",
  conversion:
    "M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8a4 4 0 0 0 0 8z M12 12.5a.5.5 0 1 0 0-1a.5.5 0 0 0 0 1z",
  returning: "M20 11a8 8 0 0 0-14.9-3.5 M4 4v4h4 M4 13a8 8 0 0 0 14.9 3.5 M20 20v-4h-4",
  gross: "M4 19V5 M4 19h16 M8 15l3-4 3 2 5-6",
  discount: "M3 12V4h8l10 10-8 8z M7.5 7.5h.01",
  shipping:
    "M3 6h11v10H3z M14 10h4l3 3v3h-7 M7 19a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3z M17 19a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3z",
  items: "M4 8l8-4 8 4v8l-8 4-8-4z M4 8l8 4 8-4 M12 12v8",
  customer:
    "M10 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7z M3 20a7 7 0 0 1 14 0 M19 8v6 M16 11h6",
  review: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  product: "M20 12l-8 8-8-8V4h8z M8 8h.01",
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5", className)}
      aria-hidden
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ---------- change against the previous period ---------- */

function change(
  now: number | null | undefined,
  before: number | null | undefined,
  points = false,
) {
  if (now == null || before == null) return null;
  if (points) {
    const d = (now - before) * 100;
    return Math.abs(d) < 0.05
      ? { text: "no change", up: null }
      : { text: `${Math.abs(d).toFixed(1)} pts`, up: d > 0 };
  }
  if (before === 0)
    return now === 0 ? { text: "no change", up: null } : { text: "new", up: true };
  const d = ((now - before) / Math.abs(before)) * 100;
  if (Math.abs(d) < 0.5) return { text: "no change", up: null };
  return {
    text: `${Math.abs(d) >= 100 ? Math.round(Math.abs(d)) : Math.abs(d).toFixed(1)}%`,
    up: d > 0,
  };
}

/* ---------- mini charts on the gradient cards (white on colour) ---------- */

function MiniBars({ values }: { values: number[] }) {
  const v = values.slice(-24);
  const max = Math.max(...v, 1);
  const W = 120;
  const H = 40;
  const bw = W / v.length;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-9 w-24"
      aria-hidden
      preserveAspectRatio="none"
    >
      {v.map((x, i) => (
        <rect
          key={i}
          x={i * bw + bw * 0.18}
          y={H - Math.max(1.5, (x / max) * H)}
          width={bw * 0.64}
          height={Math.max(1.5, (x / max) * H)}
          rx={1}
          fill="white"
          opacity={0.85}
        />
      ))}
    </svg>
  );
}

function MiniArea({ values, fill = true }: { values: number[]; fill?: boolean }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const W = 120;
  const H = 40;
  const pts = values.map(
    (v, i) => [(i / (values.length - 1)) * W, H - 3 - (v / max) * (H - 6)] as const,
  );
  const line = pts
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join("");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-9 w-24"
      aria-hidden
      preserveAspectRatio="none"
    >
      {fill && <path d={`${line}L${W},${H}L0,${H}Z`} fill="white" opacity={0.22} />}
      <path
        d={line}
        fill="none"
        stroke="white"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MiniRing({ value }: { value: number | null }) {
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  const R = 16;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90" aria-hidden>
      <circle
        cx={20}
        cy={20}
        r={R}
        fill="none"
        stroke="white"
        strokeOpacity={0.25}
        strokeWidth={5}
      />
      {v > 0 && (
        <circle
          cx={20}
          cy={20}
          r={R}
          fill="none"
          stroke="white"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${C * v} ${C}`}
        />
      )}
    </svg>
  );
}

export type Mini =
  | { kind: "bars" | "area" | "line"; values: number[] }
  | { kind: "ring"; value: number | null };

/** A headline figure on a gradient card, with a small picture of the period. */
export function GradientKpi({
  label,
  value,
  tone,
  icon,
  now,
  before,
  points,
  lowerIsBetter,
  hint,
  mini,
}: {
  label: string;
  value: string;
  tone: keyof typeof GRADIENTS;
  icon: IconName;
  now?: number | null;
  before?: number | null;
  points?: boolean;
  lowerIsBetter?: boolean;
  hint?: string;
  mini?: Mini;
}) {
  const [from, to] = GRADIENTS[tone];
  const c = change(now, before, points);
  const good = c?.up == null ? null : c.up !== !!lowerIsBetter;
  return (
    <div
      className="relative flex min-h-[148px] flex-col overflow-hidden rounded-xl p-4 text-white shadow-[0_8px_24px_-12px_rgba(17,17,17,0.45)]"
      style={{
        background: `linear-gradient(135deg, ${from} 0%, ${from} 35%, ${to} 100%)`,
      }}
    >
      <div
        aria-hidden
        className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10"
      />
      <div className="relative flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/20">
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
        <p className="text-[13px] font-medium text-white/95">{label}</p>
      </div>
      <p className="relative mt-4 text-[26px] font-bold leading-none tracking-tight">
        {value}
      </p>
      <div className="relative mt-auto flex items-end justify-between gap-2 pt-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {c && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 font-semibold">
                {c.up !== null && <span aria-hidden>{c.up ? "▲" : "▼"}</span>}
                <span className="sr-only">
                  {c.up === null ? "" : c.up ? "up" : "down"}
                </span>
                {c.text}
                {good === false && <span className="sr-only">(worse)</span>}
              </span>
            )}
            {hint && <span className="text-white/85">{hint}</span>}
          </div>
        </div>
        {mini && (
          <div className="shrink-0">
            {mini.kind === "bars" && <MiniBars values={mini.values} />}
            {mini.kind === "area" && <MiniArea values={mini.values} />}
            {mini.kind === "line" && <MiniArea values={mini.values} fill={false} />}
            {mini.kind === "ring" && <MiniRing value={mini.value} />}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- small stats with a coloured icon (under the big chart) ---------- */

export function MiniStat({
  icon,
  color,
  label,
  value,
  now,
  before,
  lowerIsBetter,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: string;
  now?: number;
  before?: number;
  lowerIsBetter?: boolean;
}) {
  const c = change(now, before);
  const good = c?.up == null ? null : c.up !== !!lowerIsBetter;
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
        style={{ background: color }}
      >
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-ink-muted">
          {label}
          {c && c.up !== null && (
            <span
              className={cn(
                "whitespace-nowrap text-[11px] font-semibold",
                good ? "text-success" : "text-sale",
              )}
            >
              {c.up ? "▲" : "▼"} {c.text}
            </span>
          )}
        </p>
        <p className="whitespace-nowrap text-[15px] font-semibold">{value}</p>
      </div>
    </div>
  );
}

/* ---------- ranked bars with a picture ---------- */

export function RankedBars({
  rows,
  format = (v) => count.format(v),
  color = PALETTE.blue,
  empty = "No data for this period yet.",
}: {
  rows: {
    name: string;
    value: number;
    extra?: string;
    image?: string | null;
    href?: string | null;
  }[];
  format?: (v: number) => string;
  color?: string;
  empty?: string;
}) {
  if (!rows.length)
    return <p className="py-6 text-center text-sm text-ink-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const withImages = rows.some((r) => r.image !== undefined);
  return (
    <ol className="space-y-3.5">
      {rows.map((r, i) => (
        <li
          key={r.name}
          className="flex items-center gap-3"
          title={`${r.name}: ${format(r.value)}`}
        >
          {withImages ? (
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-line-soft">
              {r.image && (
                <Image src={r.image} alt="" fill sizes="44px" className="object-cover" />
              )}
              <span className="absolute left-0 top-0 rounded-br-md bg-ink/80 px-1 text-[10px] font-semibold text-white">
                {i + 1}
              </span>
            </span>
          ) : (
            <span className="w-4 shrink-0 text-right text-xs font-semibold text-ink-muted">
              {i + 1}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {r.href ? (
                  <Link href={r.href} className="hover:underline">
                    {r.name}
                  </Link>
                ) : (
                  r.name
                )}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {format(r.value)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-line-soft">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.max(2, (r.value / max) * 100)}%`,
                    background: color,
                  }}
                />
              </div>
              {r.extra && (
                <span className="shrink-0 text-[11px] text-ink-muted">{r.extra}</span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- order status ---------- */

export function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? {
    label: status,
    bg: "#f1f0ec",
    fg: "#3a3a3a",
    dot: PALETTE.other,
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

/** Orders placed in the period, by where they are now: one segmented bar, every part labelled. */
export function StatusBar({ rows }: { rows: { status: string; orders: number }[] }) {
  const total = rows.reduce((s, r) => s + r.orders, 0);
  if (!total)
    return <p className="py-3 text-sm text-ink-muted">No orders in this period.</p>;
  const shown = rows.filter((r) => r.orders);
  return (
    <div>
      <div
        className="flex h-3 gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={shown
          .map((r) => `${STATUS_STYLE[r.status]?.label ?? r.status} ${r.orders}`)
          .join(", ")}
      >
        {shown.map((r) => (
          <div
            key={r.status}
            style={{
              width: `${(r.orders / total) * 100}%`,
              background: STATUS_STYLE[r.status]?.dot ?? PALETTE.other,
            }}
            title={`${STATUS_STYLE[r.status]?.label}: ${r.orders}`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {shown.map((r) => (
          <li key={r.status} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: STATUS_STYLE[r.status]?.dot ?? PALETTE.other }}
            />
            <span className="text-ink-soft">
              {STATUS_STYLE[r.status]?.label ?? r.status}
            </span>
            <span className="font-semibold tabular-nums">{count.format(r.orders)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PAY_SHORT: Record<string, string> = {
  COD: "COD",
  EASYPAISA: "Easypaisa",
  JAZZCASH: "JazzCash",
  BANK_TRANSFER: "Bank",
};

export function RecentOrdersTable({
  orders,
  money,
}: {
  orders: RecentOrder[];
  money: (cents: number) => string;
}) {
  if (!orders.length)
    return <p className="py-6 text-center text-sm text-ink-muted">No orders yet.</p>;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="bg-[#2b2f3a] text-left text-[11px] uppercase tracking-wide text-white">
            <th className="py-2.5 pl-5 font-medium">Order</th>
            <th className="py-2.5 font-medium">Customer</th>
            <th className="py-2.5 font-medium">City</th>
            <th className="py-2.5 font-medium">Payment</th>
            <th className="py-2.5 text-right font-medium">Total</th>
            <th className="py-2.5 pl-4 pr-5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {orders.map((o) => (
            <tr key={o.orderNumber} className="hover:bg-line-soft/60">
              <td className="py-2.5 pl-5 font-medium">
                <Link href={`/admin/orders/${o.orderNumber}`} className="hover:underline">
                  {o.orderNumber}
                </Link>
                <span className="block text-[11px] font-normal text-ink-muted">
                  {ago(o.createdAt)}
                </span>
              </td>
              <td className="max-w-[10rem] truncate py-2.5 pr-3">{o.customer}</td>
              <td className="max-w-[8rem] truncate py-2.5 pr-3 text-ink-soft">
                {o.city || "—"}
              </td>
              <td className="py-2.5 pr-3 text-ink-soft">
                {PAY_SHORT[o.paymentMethod] ?? o.paymentMethod}
              </td>
              <td className="py-2.5 text-right font-semibold tabular-nums">
                {money(o.totalCents)}
              </td>
              <td className="py-2.5 pl-4 pr-5">
                <StatusPill status={o.fulfillmentStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- recent activity ---------- */

function ago(d: Date) {
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days < 30
    ? `${days} ${days === 1 ? "day" : "days"} ago`
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Karachi",
      });
}

const ACTIVITY_STYLE: Record<Activity["kind"], { icon: IconName; color: string }> = {
  order: { icon: "orders", color: PALETTE.blue },
  customer: { icon: "customer", color: PALETTE.aqua },
  review: { icon: "review", color: PALETTE.orange },
  product: { icon: "product", color: PALETTE.berry },
};

export function ActivityTimeline({ items }: { items: Activity[] }) {
  if (!items.length)
    return <p className="py-6 text-center text-sm text-ink-muted">Nothing yet.</p>;
  return (
    <ol className="relative">
      {items.map((a, i) => {
        const s = ACTIVITY_STYLE[a.kind];
        return (
          <li
            key={`${a.kind}-${a.href}-${i}`}
            className="relative grid grid-cols-[4.5rem_2rem_1fr] gap-3 pb-5 last:pb-0"
          >
            <span className="pt-1.5 text-right text-[11px] leading-tight text-ink-muted">
              {ago(a.at)}
            </span>
            <span className="relative flex justify-center">
              {i < items.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-8 h-[calc(100%-0.25rem)] w-px bg-line"
                />
              )}
              <span
                className="relative grid h-8 w-8 place-items-center rounded-full text-white ring-4 ring-white"
                style={{ background: s.color }}
              >
                <Icon name={s.icon} className="h-4 w-4" />
              </span>
            </span>
            <span className="min-w-0 pt-0.5">
              <Link
                href={a.href}
                className="block truncate text-sm font-medium hover:underline"
              >
                {a.title}
              </Link>
              <span className="block truncate text-xs text-ink-muted">{a.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- searches ---------- */

/** What shoppers searched for: bigger = searched more. */
export function TagCloud({
  rows,
  empty = "No searches in this period yet.",
}: {
  rows: { name: string; value: number }[];
  empty?: string;
}) {
  if (!rows.length)
    return <p className="py-6 text-center text-sm text-ink-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value));
  const min = Math.min(...rows.map((r) => r.value));
  return (
    <ul className="flex flex-wrap items-center gap-2">
      {rows.map((r) => {
        const f = max === min ? 0.5 : (r.value - min) / (max - min);
        return (
          <li key={r.name}>
            {/* not a link: opening the shop's search from here would count as a shopper's search */}
            <span
              className="inline-flex items-baseline gap-1.5 rounded-full border border-[#d9d4f7] bg-[#f3f1fd] px-3 py-1 text-[#3f3290]"
              style={{ fontSize: `${12 + f * 8}px`, fontWeight: f > 0.6 ? 600 : 500 }}
            >
              {r.name}
              <span className="text-[11px] font-normal text-[#6b62a8]">
                {count.format(r.value)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- frustration signals (Clarity) ---------- */

export function SignalBars({
  rows,
}: {
  rows: { key: string; label: string; help: string; sessionsPct: number | null }[];
}) {
  const max = Math.max(...rows.map((r) => r.sessionsPct ?? 0), 1);
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => {
        const v = r.sessionsPct ?? 0;
        const level = v >= 10 ? "#d03b3b" : v >= 3 ? "#ec835a" : "#0ca30c";
        return (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="font-semibold tabular-nums">
                {r.sessionsPct === null ? "—" : `${v.toFixed(1)}%`}
              </span>
            </div>
            <div className="relative mt-1.5 h-3">
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
              <div
                className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
                style={{ width: `${(v / max) * 100}%`, background: level }}
              />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                style={{ left: `${(v / max) * 100}%`, background: level }}
              />
            </div>
            <p className="mt-1 text-xs text-ink-muted">{r.help}</p>
          </li>
        );
      })}
    </ul>
  );
}
