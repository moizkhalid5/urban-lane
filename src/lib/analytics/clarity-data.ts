import { cached } from "@/lib/analytics/cache";

/**
 * Admin → Analytics, from Microsoft Clarity: its Data Export API, which covers the last 1–3 days only and
 * allows 10 requests a day per project. One request (the last 3 days) is saved for 3 hours, so at most 8 a day
 * are used. The token is made in Clarity under Settings → Data export.
 */
const API = "https://www.clarity.ms/export-data/api/v1/project-live-insights";
const MAX_AGE = 3 * 60 * 60 * 1000;

type Metric = { metricName?: string; information?: Record<string, unknown>[] };

export type ClaritySignal = { key: string; label: string; help: string; sessionsPct: number | null; count: number | null };
export type ClarityReport = {
  sessions: number | null;
  botSessions: number | null;
  users: number | null;
  pagesPerSession: number | null;
  scrollDepth: number | null;
  activeSeconds: number | null;
  totalSeconds: number | null;
  signals: ClaritySignal[];
  pages: { name: string; value: number }[];
  devices: { name: string; value: number }[];
};

const SIGNALS = [
  { key: "RageClickCount", label: "Rage clicks", help: "Clicking the same spot again and again, usually something that doesn't respond." },
  { key: "DeadClickCount", label: "Dead clicks", help: "Clicks on things that do nothing, like text or a picture that looks like a button." },
  { key: "QuickbackClick", label: "Quick backs", help: "Opened a page and went straight back: not what they expected." },
  { key: "ExcessiveScroll", label: "Excessive scrolling", help: "Scrolling up and down a lot: hunting for something." },
  { key: "ErrorClickCount", label: "Error clicks", help: "A click that led to an error on the page." },
  { key: "ScriptErrorCount", label: "Page errors", help: "Visits where something on the page broke." },
];

/**
 * Clarity's field names vary in case (and one is spelt "distant"), so fields are looked up loosely; the first
 * of `names` that's there wins.
 */
function field(info: Record<string, unknown> | undefined, ...names: string[]): number | null {
  if (!info) return null;
  const entries = Object.entries(info);
  for (const name of names) {
    const found = entries.find(([k]) => k.toLowerCase() === name.toLowerCase());
    const n = Number(found?.[1]);
    if (found && Number.isFinite(n)) return n;
  }
  return null;
}
const text = (info: Record<string, unknown>, ...names: string[]) => {
  for (const [k, v] of Object.entries(info)) if (names.some((n) => n.toLowerCase() === k.toLowerCase()) && typeof v === "string") return v;
  return null;
};

export function parseClarity(metrics: Metric[]): ClarityReport {
  const get = (name: string) => metrics.find((m) => m.metricName?.toLowerCase() === name.toLowerCase())?.information ?? [];
  const traffic = get("Traffic")[0];
  const engagement = get("EngagementTime")[0];
  const named = (name: string, ...valueKeys: string[]) =>
    get(name)
      .map((i) => ({ name: text(i, "name", "url", "Device", "pageTitle") ?? "", value: field(i, ...valueKeys) ?? 0 }))
      .filter((r) => r.name)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  return {
    sessions: field(traffic, "totalSessionCount"),
    botSessions: field(traffic, "totalBotSessionCount"),
    users: field(traffic, "distinctUserCount", "distantUserCount"),
    pagesPerSession: field(traffic, "pagesPerSessionPercentage", "pagesPerSession"),
    scrollDepth: field(get("ScrollDepth")[0], "averageScrollDepth"),
    activeSeconds: field(engagement, "activeTime"),
    totalSeconds: field(engagement, "totalTime"),
    signals: SIGNALS.map((s) => {
      const info = get(s.key)[0];
      return { ...s, sessionsPct: field(info, "sessionsWithMetricPercentage"), count: field(info, "subTotal", "sessionsCount") };
    }),
    pages: named("PopularPages", "visitsCount", "sessionsCount"),
    devices: named("Device", "sessionsCount"),
  };
}

export function clarityReport(projectId: string, token: string) {
  return cached(`clarity:${projectId}`, MAX_AGE, async () => {
    const res = await fetch(`${API}?numOfDays=3`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (res.status === 401 || res.status === 403) throw new Error("Clarity didn't accept the API token.");
    if (res.status === 429) throw new Error("Clarity's limit of 10 exports a day is used up; it resets tomorrow.");
    if (!res.ok) throw new Error(`Clarity: ${res.status}`);
    return parseClarity((await res.json()) as Metric[]);
  });
}

/** Links into the Clarity website for this project. */
export function clarityLinks(projectId: string) {
  const base = `https://clarity.microsoft.com/projects/view/${projectId}`;
  return { dashboard: `${base}/dashboard`, recordings: `${base}/impressions`, heatmaps: `${base}/heatmaps` };
}
