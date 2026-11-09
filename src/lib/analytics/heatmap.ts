import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { shopDate } from "@/lib/analytics/ranges";

/**
 * Urban Lane's own click and scroll maps (Admin → Analytics → Heatmaps). Shop pages send clicks and how far
 * down each page view got (components/analytics/HeatmapRecorder.tsx → app/api/hm). No visitor ID, IP or
 * typed text is kept. The tables are made on first use (same SQL as prisma/migrations/20261105120000_heatmaps),
 * because the host's deploy doesn't run migrations.
 */
const CREATE = [
  `CREATE TABLE IF NOT EXISTS \`HeatmapClick\` (
    \`id\` BIGINT NOT NULL AUTO_INCREMENT,
    \`day\` DATE NOT NULL,
    \`path\` VARCHAR(191) NOT NULL,
    \`device\` VARCHAR(8) NOT NULL,
    \`selector\` VARCHAR(512) NOT NULL,
    \`rx\` SMALLINT NOT NULL,
    \`ry\` SMALLINT NOT NULL,
    \`x\` SMALLINT NOT NULL,
    \`y\` INTEGER NOT NULL,
    \`label\` VARCHAR(80) NULL,
    INDEX \`HeatmapClick_path_device_day_idx\`(\`path\`, \`device\`, \`day\`),
    INDEX \`HeatmapClick_day_idx\`(\`day\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`HeatmapView\` (
    \`id\` BIGINT NOT NULL AUTO_INCREMENT,
    \`day\` DATE NOT NULL,
    \`path\` VARCHAR(191) NOT NULL,
    \`device\` VARCHAR(8) NOT NULL,
    \`depth\` TINYINT NOT NULL,
    INDEX \`HeatmapView_path_device_day_idx\`(\`path\`, \`device\`, \`day\`),
    INDEX \`HeatmapView_day_idx\`(\`day\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
];

export const DEVICES = ["desktop", "tablet", "mobile"] as const;
export type Device = (typeof DEVICES)[number];
export const KEEP_DAYS = 90;

let ready: Promise<void> | null = null;
export function ensureHeatmapTables(): Promise<void> {
  ready ??= (async () => {
    for (const sql of CREATE) await prisma.$executeRawUnsafe(sql);
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

/** Shop pages only, without the query string; never the admin, sign-in or account pages. */
const PATH = /^\/[A-Za-z0-9\-._~%/]*$/;
const PRIVATE = /^\/(admin|api|account|login|register|forgot-password|reset-password|checkout\/success)(\/|$)/;
export function cleanPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 191 || !PATH.test(raw) || PRIVATE.test(raw)) return null;
  return raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
}

const int = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : null);
const device = (v: unknown): Device | null => (DEVICES as readonly string[]).includes(v as string) ? (v as Device) : null;

export type IncomingClick = { p: string; d: string; s: string; rx: number; ry: number; x: number; y: number; l?: string | null };
export type IncomingView = { p: string; d: string; depth: number };

/** Saves what a shop page sent, after checking every field. Bad entries are dropped, not fatal. */
export async function recordHeatmap(body: { c?: unknown; v?: unknown }) {
  const day = new Date(`${shopDate(new Date())}T00:00:00Z`);
  const clicks: Prisma.HeatmapClickCreateManyInput[] = [];
  for (const c of Array.isArray(body.c) ? body.c.slice(0, 60) : []) {
    const path = cleanPath(c?.p);
    const d = device(c?.d);
    const sel = typeof c?.s === "string" && c.s.length <= 512 && /^[a-z0-9#>:() \-_]+$/i.test(c.s) ? c.s : null;
    const rx = int(c?.rx, 0, 1000);
    const ry = int(c?.ry, 0, 1000);
    const x = int(c?.x, 0, 1000);
    const y = int(c?.y, 0, 200_000);
    if (!path || !d || !sel || rx === null || ry === null || x === null || y === null) continue;
    const label = typeof c?.l === "string" ? c.l.replace(/\s+/g, " ").trim().slice(0, 80) || null : null;
    clicks.push({ day, path, device: d, selector: sel, rx, ry, x, y, label });
  }
  const views: Prisma.HeatmapViewCreateManyInput[] = [];
  for (const v of Array.isArray(body.v) ? body.v.slice(0, 10) : []) {
    const path = cleanPath(v?.p);
    const d = device(v?.d);
    const depth = int(v?.depth, 0, 100);
    if (path && d && depth !== null) views.push({ day, path, device: d, depth });
  }
  if (!clicks.length && !views.length) return;
  await ensureHeatmapTables();
  await Promise.all([
    clicks.length ? prisma.heatmapClick.createMany({ data: clicks }) : null,
    views.length ? prisma.heatmapView.createMany({ data: views }) : null,
  ]);
  // Now and then, clear out anything past its 90 days.
  if (Math.random() < 0.01) {
    const cutoff = new Date(day.getTime() - KEEP_DAYS * 86_400_000);
    await prisma.heatmapClick.deleteMany({ where: { day: { lt: cutoff } } });
    await prisma.heatmapView.deleteMany({ where: { day: { lt: cutoff } } });
  }
}

const dayOf = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Pages with recorded views in the period, busiest first. */
export async function heatmapPages(from: string, to: string) {
  await ensureHeatmapTables();
  const rows = await prisma.heatmapView.groupBy({
    by: ["path"],
    where: { day: { gte: dayOf(from), lte: dayOf(to) } },
    _count: { _all: true },
    orderBy: { _count: { path: "desc" } },
    take: 40,
  });
  return rows.map((r) => ({ path: r.path, views: r._count._all }));
}

export type HeatmapData = {
  views: number;
  clicks: number;
  /** clicks grouped by element and spot inside it */
  spots: { s: string; rx: number; ry: number; x: number; y: number; n: number }[];
  /** what was clicked, by its words (link text, button name, picture description) */
  labels: { label: string; n: number; s: string }[];
  /** share of page views that got at least this far down, every 5% from 0 to 100 */
  reach: number[];
  averageDepth: number | null;
};

export async function heatmapData(path: string, d: Device, from: string, to: string): Promise<HeatmapData> {
  await ensureHeatmapTables();
  const lo = dayOf(from);
  const hi = dayOf(to);
  const [spots, labels, depths, clicks] = await Promise.all([
    prisma.$queryRaw<{ s: string; bx: number; bz: number; x: number; y: number; n: bigint }[]>`
      SELECT selector AS s, ROUND(rx / 20) AS bx, ROUND(ry / 20) AS bz, AVG(x) AS x, AVG(y) AS y, COUNT(*) AS n
      FROM HeatmapClick WHERE path = ${path} AND device = ${d} AND day BETWEEN ${lo} AND ${hi}
      GROUP BY selector, bx, bz ORDER BY n DESC LIMIT 5000`,
    prisma.$queryRaw<{ label: string; n: bigint; s: string }[]>`
      SELECT label, COUNT(*) AS n, MIN(selector) AS s
      FROM HeatmapClick WHERE path = ${path} AND device = ${d} AND day BETWEEN ${lo} AND ${hi} AND label IS NOT NULL
      GROUP BY label ORDER BY n DESC LIMIT 12`,
    prisma.heatmapView.groupBy({
      by: ["depth"],
      where: { path, device: d, day: { gte: lo, lte: hi } },
      _count: { _all: true },
    }),
    prisma.heatmapClick.count({ where: { path, device: d, day: { gte: lo, lte: hi } } }),
  ]);
  const views = depths.reduce((s, r) => s + r._count._all, 0);
  const reach = Array.from({ length: 21 }, (_, i) =>
    views ? depths.filter((r) => r.depth >= i * 5).reduce((s, r) => s + r._count._all, 0) / views : 0,
  );
  return {
    views,
    clicks,
    spots: spots.map((r) => ({ s: r.s, rx: Number(r.bx) * 20, ry: Number(r.bz) * 20, x: Number(r.x), y: Number(r.y), n: Number(r.n) })),
    labels: labels.map((r) => ({ label: r.label, n: Number(r.n), s: r.s })),
    reach,
    averageDepth: views ? depths.reduce((s, r) => s + r.depth * r._count._all, 0) / views : null,
  };
}
