import { createSign } from "crypto";
import type { GaServiceKey } from "@/lib/analytics/settings";
import type { ReportRange } from "@/lib/analytics/ranges";
import { cached } from "@/lib/analytics/cache";

/**
 * Admin → Analytics, from Google Analytics: the GA4 Data API, with a read-only service account (Admin →
 * Settings → Analytics). Plain HTTPS requests, no Google library: a signed JWT is swapped for an access token.
 */
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const API = "https://analyticsdata.googleapis.com/v1beta/properties";

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

let token: { email: string; value: string; expires: number } | null = null;

async function accessToken(key: GaServiceKey): Promise<string> {
  if (token && token.email === key.client_email && token.expires > Date.now() + 60_000) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }),
  )}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description ?? body.error ?? res.status}`);
  token = { email: key.client_email, value: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function call<T>(key: GaServiceKey, url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(key)}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Analytics: ${json?.error?.message ?? res.status}`);
  return json as T;
}

type Row = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
type Report = { rows?: Row[]; totals?: Row[] };

const dims = (names: string[]) => names.map((name) => ({ name }));
const mets = (names: string[]) => names.map((name) => ({ name }));
const num = (v: string | undefined) => Number(v ?? 0) || 0;
const ranges = (r: ReportRange, withPrevious = false) => [
  { startDate: r.current.from, endDate: r.current.to, name: "current" },
  ...(withPrevious ? [{ startDate: r.previous.from, endDate: r.previous.to, name: "previous" }] : []),
];
/** "(not set)" and empty values aren't worth a row. */
const set = (v: string | undefined) => !!v && v !== "(not set)" && v !== "(other)";

export type NameValue = { name: string; value: number };
export type GaReport = {
  sessions: number;
  previousSessions: number;
  visitors: number;
  previousVisitors: number;
  engagementRate: number | null;
  /** sessions per day, by position in the period */
  sessionsByDay: { date: string; sessions: number; previousSessions: number }[];
  funnel: { visitors: number; viewedProduct: number; addedToBag: number; checkout: number; purchased: number };
  channels: NameValue[];
  sources: NameValue[];
  devices: NameValue[];
  countries: NameValue[];
  cities: NameValue[];
  landingPages: NameValue[];
  searches: NameValue[];
  /** new and returning visitors (GA's own view: a returning visitor has been before on this device) */
  visitorTypes: NameValue[];
  products: { name: string; views: number; addedToBag: number; purchased: number }[];
};

async function fetchGaReport(key: GaServiceKey, property: string, r: ReportRange): Promise<GaReport> {
  const top = (dimension: string, metric = "sessions", limit = 10, extra: object = {}) => ({
    dateRanges: ranges(r),
    dimensions: dims([dimension]),
    metrics: mets([metric]),
    orderBys: [{ metric: { metricName: metric }, desc: true }],
    limit,
    ...extra,
  });
  const [a, b] = await Promise.all([
    call<{ reports: Report[] }>(key, `${API}/${property}:batchRunReports`, {
      requests: [
        { dateRanges: ranges(r, true), dimensions: dims(["date"]), metrics: mets(["sessions"]), limit: 400 },
        { dateRanges: ranges(r, true), metrics: mets(["sessions", "activeUsers", "engagementRate"]) },
        {
          dateRanges: ranges(r),
          dimensions: dims(["eventName"]),
          metrics: mets(["activeUsers"]),
          dimensionFilter: {
            filter: { fieldName: "eventName", inListFilter: { values: ["view_item", "add_to_cart", "begin_checkout", "purchase"] } },
          },
        },
        top("sessionDefaultChannelGroup"),
        top("sessionSource"),
      ],
    }),
    call<{ reports: Report[] }>(key, `${API}/${property}:batchRunReports`, {
      requests: [
        top("deviceCategory"),
        top("country"),
        top("city"),
        top("landingPage"),
        top("searchTerm", "eventCount"),
      ],
    }),
  ]);
  const [products, visitorTypes] = await Promise.all([
    call<Report>(key, `${API}/${property}:runReport`, {
      dateRanges: ranges(r),
      dimensions: dims(["itemName"]),
      metrics: mets(["itemsViewed", "itemsAddedToCart", "itemsPurchased"]),
      orderBys: [{ metric: { metricName: "itemsViewed" }, desc: true }],
      limit: 10,
    }),
    call<Report>(key, `${API}/${property}:runReport`, top("newVsReturning", "activeUsers", 5)),
  ]);

  const [trend, overall, events, channels, sources] = a.reports;
  const [devices, countries, cities, landing, searches] = b.reports;

  // With two date ranges, each row ends with which range it's from.
  const byRange = (rows: Row[] | undefined, name: string) =>
    (rows ?? []).filter((row) => row.dimensionValues?.at(-1)?.value === name);
  const perDay = (name: string) => {
    const m = new Map<string, number>();
    for (const row of byRange(trend.rows, name)) {
      const d = row.dimensionValues![0].value;
      m.set(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, num(row.metricValues?.[0]?.value));
    }
    return m;
  };
  const curDays = perDay("current");
  const prevDays = perDay("previous");
  const totalsFor = (name: string) => byRange(overall.rows, name)[0]?.metricValues ?? [];
  const cur = totalsFor("current");
  const prev = totalsFor("previous");
  const event = (name: string) => num(events.rows?.find((row) => row.dimensionValues?.[0]?.value === name)?.metricValues?.[0]?.value);
  const list = (rep: Report): NameValue[] =>
    (rep.rows ?? [])
      .filter((row) => set(row.dimensionValues?.[0]?.value))
      .map((row) => ({ name: row.dimensionValues![0].value, value: num(row.metricValues?.[0]?.value) }));

  return {
    sessions: num(cur[0]?.value),
    previousSessions: num(prev[0]?.value),
    visitors: num(cur[1]?.value),
    previousVisitors: num(prev[1]?.value),
    engagementRate: cur[2] ? num(cur[2].value) : null,
    sessionsByDay: r.current.days.map((date, i) => ({
      date,
      sessions: curDays.get(date) ?? 0,
      previousSessions: prevDays.get(r.previous.days[i]) ?? 0,
    })),
    funnel: {
      visitors: num(cur[1]?.value),
      viewedProduct: event("view_item"),
      addedToBag: event("add_to_cart"),
      checkout: event("begin_checkout"),
      purchased: event("purchase"),
    },
    channels: list(channels),
    sources: list(sources),
    devices: list(devices),
    countries: list(countries),
    cities: list(cities),
    landingPages: list(landing),
    searches: list(searches),
    visitorTypes: list(visitorTypes).map((v) => ({ ...v, name: v.name === "new" ? "New visitors" : v.name === "returning" ? "Returning visitors" : v.name })),
    products: (products.rows ?? [])
      .filter((row) => set(row.dimensionValues?.[0]?.value))
      .map((row) => ({
        name: row.dimensionValues![0].value,
        views: num(row.metricValues?.[0]?.value),
        addedToBag: num(row.metricValues?.[1]?.value),
        purchased: num(row.metricValues?.[2]?.value),
      })),
  };
}

/** Saved for 15 minutes (5 for today's figures, which move faster). */
export function gaReport(key: GaServiceKey, property: string, r: ReportRange) {
  const maxAge = r.key === "today" ? 5 * 60_000 : 15 * 60_000;
  return cached(`ga:${property}:${r.current.from}:${r.current.to}`, maxAge, () => fetchGaReport(key, property, r));
}

/** Visitors on the shop in the last 30 minutes. Saved for a minute. */
export function gaRealtime(key: GaServiceKey, property: string) {
  return cached(`ga-live:${property}`, 60_000, async () => {
    const rep = await call<Report>(key, `${API}/${property}:runRealtimeReport`, { metrics: mets(["activeUsers"]) });
    return num(rep.rows?.[0]?.metricValues?.[0]?.value);
  });
}
