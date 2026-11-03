import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Google Analytics 4 and Microsoft Clarity IDs (Admin → Settings → Analytics). Empty = that tool is off.
 * The table is created on first use (same SQL as prisma/migrations/20261103120000_analytics_settings),
 * because the host's deploy doesn't run migrations.
 */
const CREATE_SETTINGS = `CREATE TABLE IF NOT EXISTS \`AnalyticsSettings\` (
    \`id\` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    \`gaMeasurementId\` VARCHAR(20) NULL,
    \`clarityProjectId\` VARCHAR(20) NULL,
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

/** "G-" and 4–15 letters or digits, as Google shows it under Admin → Data streams. */
export const GA_ID = /^G-[A-Z0-9]{4,15}$/;
/** As Clarity shows it under Settings → Overview: lowercase letters and digits. */
export const CLARITY_ID = /^[a-z0-9]{6,15}$/;

/** Urban Lane's own accounts, so the live shop measures from its first start without anyone entering them. */
const DEFAULT_GA_ID = "G-SKDY3JMBS3";
const DEFAULT_CLARITY_ID = "z80547xike";

let ready: Promise<void> | null = null;
export function ensureAnalyticsTable(): Promise<void> {
  ready ??= (async () => {
    await prisma.$executeRawUnsafe(CREATE_SETTINGS);
    // Only when nothing was ever saved: IDs changed or removed in the admin stay as they are.
    await prisma.$executeRawUnsafe(
      "INSERT IGNORE INTO `AnalyticsSettings` (`id`, `gaMeasurementId`, `clarityProjectId`, `updatedAt`) VALUES ('singleton', ?, ?, NOW(3))",
      DEFAULT_GA_ID,
      DEFAULT_CLARITY_ID,
    );
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

export type AnalyticsIds = { gaMeasurementId: string | null; clarityProjectId: string | null };

/** Per-request cached. Never throws: if the settings can't be read, the shop just runs without analytics. */
export const getAnalyticsIds = cache(async (): Promise<AnalyticsIds> => {
  try {
    await ensureAnalyticsTable();
    const s = await prisma.analyticsSettings.findUnique({ where: { id: "singleton" } });
    return {
      gaMeasurementId: s?.gaMeasurementId && GA_ID.test(s.gaMeasurementId) ? s.gaMeasurementId : null,
      clarityProjectId: s?.clarityProjectId && CLARITY_ID.test(s.clarityProjectId) ? s.clarityProjectId : null,
    };
  } catch {
    return { gaMeasurementId: null, clarityProjectId: null };
  }
});
