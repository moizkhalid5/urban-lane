import { prisma } from "@/lib/prisma";
import { ensureAnalyticsTable } from "@/lib/analytics/settings";

/**
 * Report responses saved in the database (AnalyticsCache), so pages open quickly, Google's quotas last, and
 * Clarity's limit of 10 exports a day isn't used up. Shared by every admin and kept across restarts.
 * A failed fetch falls back to the last saved copy, marked as such.
 */
export type Cached<T> = { data: T; fetchedAt: Date; stale: boolean };

export async function cached<T>(key: string, maxAgeMs: number, fetch: () => Promise<T>): Promise<Cached<T>> {
  await ensureAnalyticsTable();
  const saved = await prisma.analyticsCache.findUnique({ where: { key } });
  if (saved && Date.now() - saved.fetchedAt.getTime() < maxAgeMs) {
    return { data: JSON.parse(saved.data) as T, fetchedAt: saved.fetchedAt, stale: false };
  }
  try {
    const data = await fetch();
    const fetchedAt = new Date();
    await prisma.analyticsCache.upsert({
      where: { key },
      update: { data: JSON.stringify(data), fetchedAt },
      create: { key, data: JSON.stringify(data), fetchedAt },
    });
    return { data, fetchedAt, stale: false };
  } catch (err) {
    if (saved) return { data: JSON.parse(saved.data) as T, fetchedAt: saved.fetchedAt, stale: true };
    throw err;
  }
}

/** After the connection changes, so the next report is fetched with it. */
export async function clearAnalyticsCache() {
  await ensureAnalyticsTable();
  await prisma.analyticsCache.deleteMany({});
}
