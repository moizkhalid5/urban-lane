import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/analytics/secrets";

/**
 * Google Analytics 4 and Microsoft Clarity (Admin → Settings → Analytics): the IDs the shop sends visits to
 * (empty = that tool is off), and the read-only access that Admin → Analytics reports with.
 * The tables are created on first use (same SQL as prisma/migrations/20261103120000_analytics_settings and
 * 20261104120000_analytics_reports), because the host's deploy doesn't run migrations.
 */
const CREATE_SETTINGS = `CREATE TABLE IF NOT EXISTS \`AnalyticsSettings\` (
    \`id\` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    \`gaMeasurementId\` VARCHAR(20) NULL,
    \`clarityProjectId\` VARCHAR(20) NULL,
    \`gaPropertyId\` VARCHAR(20) NULL,
    \`gaServiceKey\` TEXT NULL,
    \`clarityApiToken\` TEXT NULL,
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

/** For a table made before the reports existed. */
const REPORT_COLUMNS: [string, string][] = [
  ["gaPropertyId", "VARCHAR(20) NULL"],
  ["gaServiceKey", "TEXT NULL"],
  ["clarityApiToken", "TEXT NULL"],
];

const CREATE_CACHE = `CREATE TABLE IF NOT EXISTS \`AnalyticsCache\` (
    \`key\` VARCHAR(191) NOT NULL,
    \`data\` LONGTEXT NOT NULL,
    \`fetchedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`key\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

/** "G-" and 4–15 letters or digits, as Google shows it under Admin → Data streams. */
export const GA_ID = /^G-[A-Z0-9]{4,15}$/;
/** As Clarity shows it under Settings → Overview: lowercase letters and digits. */
export const CLARITY_ID = /^[a-z0-9]{6,15}$/;
/** The GA4 property number (Admin → Property details), e.g. 512345678. */
export const GA_PROPERTY = /^\d{6,12}$/;

/** Urban Lane's own accounts, so the live shop measures from its first start without anyone entering them. */
const DEFAULT_GA_ID = "G-SKDY3JMBS3";
const DEFAULT_CLARITY_ID = "z80547xike";

let ready: Promise<void> | null = null;
export function ensureAnalyticsTable(): Promise<void> {
  ready ??= (async () => {
    await prisma.$executeRawUnsafe(CREATE_SETTINGS);
    const existing = await prisma.$queryRawUnsafe<{ name: string }[]>(
      "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AnalyticsSettings'",
    );
    const have = new Set(existing.map((c) => c.name));
    for (const [column, type] of REPORT_COLUMNS) {
      if (!have.has(column)) await prisma.$executeRawUnsafe(`ALTER TABLE \`AnalyticsSettings\` ADD COLUMN \`${column}\` ${type}`);
    }
    await prisma.$executeRawUnsafe(CREATE_CACHE);
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

/** A Google service account key file, as downloaded from Google Cloud. */
export type GaServiceKey = { client_email: string; private_key: string };

export type ReportAccess = {
  clarityProjectId: string | null;
  gaPropertyId: string | null;
  gaKey: GaServiceKey | null;
  clarityToken: string | null;
};

/** Server only: what Admin → Analytics reports with. Secrets are decrypted here and never sent to a browser. */
export async function getReportAccess(): Promise<ReportAccess> {
  await ensureAnalyticsTable();
  const s = await prisma.analyticsSettings.findUnique({ where: { id: "singleton" } });
  let gaKey: GaServiceKey | null = null;
  try {
    const parsed = JSON.parse(decryptSecret(s?.gaServiceKey) ?? "null");
    if (parsed?.client_email && parsed?.private_key) gaKey = { client_email: parsed.client_email, private_key: parsed.private_key };
  } catch {}
  return {
    clarityProjectId: s?.clarityProjectId ?? null,
    gaPropertyId: s?.gaPropertyId && GA_PROPERTY.test(s.gaPropertyId) ? s.gaPropertyId : null,
    gaKey,
    clarityToken: decryptSecret(s?.clarityApiToken),
  };
}

/** For the settings form: what's connected, without the secrets themselves. */
export async function getReportAccessSummary() {
  const a = await getReportAccess();
  return {
    gaPropertyId: a.gaPropertyId ?? "",
    gaKeyEmail: a.gaKey?.client_email ?? null,
    clarityTokenSaved: !!a.clarityToken,
  };
}
