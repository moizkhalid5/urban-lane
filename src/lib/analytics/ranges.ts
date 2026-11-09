/**
 * Date ranges for Admin → Analytics, in Pakistan time (UTC+5, no daylight saving), and the period before
 * each to compare with. A range covers whole days: `from` and `to` are dates (YYYY-MM-DD), both included.
 */
export const SHOP_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

export const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "lastmonth", label: "Last month" },
  { key: "year", label: "This year" },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"] | "custom";
export const DEFAULT_RANGE: RangeKey = "30d";
/** A custom range can be up to a year and a bit long. */
export const MAX_CUSTOM_DAYS = 400;

export type Period = { from: string; to: string; days: string[] };
export type ReportRange = { key: RangeKey; label: string; current: Period; previous: Period };

const DAY = 24 * 60 * 60 * 1000;
const iso = (shopMs: number) => new Date(shopMs).toISOString().slice(0, 10);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function period(fromMs: number, toMs: number): Period {
  const days: string[] = [];
  for (let t = fromMs; t <= toMs; t += DAY) days.push(iso(t));
  return { from: iso(fromMs), to: iso(toMs), days };
}

/** Midnight today, shop time, as a UTC timestamp whose date is the shop's date. */
export const shopToday = (now = new Date()) => Math.floor((now.getTime() + SHOP_UTC_OFFSET_MS) / DAY) * DAY;
export const shopTodayIso = (now = new Date()) => iso(shopToday(now));

export function reportRange(raw: string | undefined, now = new Date(), custom?: { from?: string; to?: string }): ReportRange {
  const today = shopToday(now);
  let from: number;
  let to = today;
  let key: RangeKey;
  let label: string;

  const cf = custom?.from && DATE.test(custom.from) ? Date.parse(`${custom.from}T00:00:00Z`) : NaN;
  const ct = custom?.to && DATE.test(custom.to) ? Date.parse(`${custom.to}T00:00:00Z`) : NaN;
  if (raw === "custom" && Number.isFinite(cf) && Number.isFinite(ct)) {
    // Never past today, never backwards, never longer than MAX_CUSTOM_DAYS.
    to = Math.min(Math.max(cf, ct), today);
    from = Math.max(Math.min(cf, ct, to), to - (MAX_CUSTOM_DAYS - 1) * DAY);
    key = "custom";
    label = "Custom";
  } else {
    const found = RANGES.find((r) => r.key === raw) ?? RANGES.find((r) => r.key === DEFAULT_RANGE)!;
    key = found.key;
    label = found.label;
    const d = new Date(today);
    switch (found.key) {
      case "today":
        from = today;
        break;
      case "yesterday":
        from = to = today - DAY;
        break;
      case "7d":
        from = today - 6 * DAY;
        break;
      case "90d":
        from = today - 89 * DAY;
        break;
      case "month":
        from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
        break;
      case "lastmonth":
        from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
        to = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - DAY;
        break;
      case "year":
        from = Date.UTC(d.getUTCFullYear(), 0, 1);
        break;
      default:
        from = today - 29 * DAY;
    }
  }

  // Compared with the period just before, of the same length. Calendar ranges compare with the same
  // stretch of the month or year before (1–4 Nov against 1–4 Oct), as Shopify does.
  let previous: Period;
  if (key === "month" || key === "lastmonth" || key === "year") {
    const f = new Date(from);
    const pFrom = key === "year" ? Date.UTC(f.getUTCFullYear() - 1, 0, 1) : Date.UTC(f.getUTCFullYear(), f.getUTCMonth() - 1, 1);
    const pEnd = from - DAY;
    previous = period(pFrom, Math.min(pFrom + (to - from), pEnd));
  } else {
    const length = to - from + DAY;
    previous = period(from - length, to - length);
  }
  return { key, label, current: period(from, to), previous };
}

/** The real UTC instants a period covers, for database queries: [start, end). */
export function periodBounds(p: Period): { gte: Date; lt: Date } {
  return {
    gte: new Date(Date.parse(`${p.from}T00:00:00Z`) - SHOP_UTC_OFFSET_MS),
    lt: new Date(Date.parse(`${p.to}T00:00:00Z`) + DAY - SHOP_UTC_OFFSET_MS),
  };
}

/** The shop date (YYYY-MM-DD) of an instant. */
export const shopDate = (d: Date) => iso(d.getTime() + SHOP_UTC_OFFSET_MS);
