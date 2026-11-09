"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { CLARITY_ID, GA_ID, GA_PROPERTY, ensureAnalyticsTable, getReportAccess } from "@/lib/analytics/settings";
import { encryptSecret } from "@/lib/analytics/secrets";
import { clearAnalyticsCache } from "@/lib/analytics/cache";
import { gaRealtime } from "@/lib/analytics/ga-data";

export type AnalyticsResult = { ok: boolean; message?: string };

const schema = z.object({
  gaMeasurementId: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || GA_ID.test(v), "The Google Analytics ID looks like G-AB12CD34EF."),
  clarityProjectId: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || CLARITY_ID.test(v), "The Clarity project ID is 6–15 letters and numbers, e.g. abcd1234ef."),
});

/** Admin → Settings → Analytics. Leaving an ID empty turns that tool off. */
export async function saveAnalyticsIds(input: unknown): Promise<AnalyticsResult> {
  const user = await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  const data = {
    gaMeasurementId: parsed.data.gaMeasurementId || null,
    clarityProjectId: parsed.data.clarityProjectId || null,
  };
  await ensureAnalyticsTable();
  await prisma.analyticsSettings.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
  await logAudit(user.id, "settings.analytics", "AnalyticsSettings", "singleton", data);
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. Shop pages use the new settings straight away." };
}

const accessSchema = z.object({
  gaPropertyId: z
    .string()
    .trim()
    .refine((v) => v === "" || GA_PROPERTY.test(v), "The property ID is a number, e.g. 512345678 (Google Analytics → Admin → Property details)."),
  /** the key file's contents; empty = keep the saved key */
  gaServiceKey: z.string().trim().max(10000),
  /** empty = keep the saved token */
  clarityApiToken: z.string().trim().max(5000),
  removeGaKey: z.boolean().default(false),
  removeClarityToken: z.boolean().default(false),
});

/**
 * Admin → Settings → Analytics: read-only access for the reports in Admin → Analytics. The key and token are
 * stored encrypted and never shown again; they're checked with Google straight away.
 */
export async function saveReportAccess(input: unknown): Promise<AnalyticsResult> {
  const user = await requireAdmin();
  const parsed = accessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  const { gaPropertyId, gaServiceKey, clarityApiToken, removeGaKey, removeClarityToken } = parsed.data;

  let keyJson: string | undefined;
  if (gaServiceKey) {
    try {
      const k = JSON.parse(gaServiceKey);
      if (k.type !== "service_account" || !k.client_email || !k.private_key) throw new Error();
      keyJson = JSON.stringify({ client_email: k.client_email, private_key: k.private_key });
    } catch {
      return { ok: false, message: "That isn't a service account key. Paste the whole contents of the .json file Google downloaded." };
    }
  }

  await ensureAnalyticsTable();
  const data = {
    gaPropertyId: gaPropertyId || null,
    ...(keyJson ? { gaServiceKey: encryptSecret(keyJson) } : removeGaKey ? { gaServiceKey: null } : {}),
    ...(clarityApiToken ? { clarityApiToken: encryptSecret(clarityApiToken) } : removeClarityToken ? { clarityApiToken: null } : {}),
  };
  await prisma.analyticsSettings.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
  await clearAnalyticsCache();
  await logAudit(user.id, "settings.analytics_reports", "AnalyticsSettings", "singleton", {
    gaPropertyId: data.gaPropertyId,
    gaKey: keyJson ? "replaced" : removeGaKey ? "removed" : "unchanged",
    clarityToken: clarityApiToken ? "replaced" : removeClarityToken ? "removed" : "unchanged",
  });
  revalidatePath("/admin/analytics");
  revalidatePath("/admin/settings");

  // Check Google straight away (Clarity isn't checked here: it allows only 10 requests a day).
  const access = await getReportAccess();
  if (access.gaKey && access.gaPropertyId) {
    try {
      await gaRealtime(access.gaKey, access.gaPropertyId);
    } catch (err) {
      return {
        ok: false,
        message: `Saved, but Google refused it: ${err instanceof Error ? err.message : "unknown error"}. Check the property ID, and that ${access.gaKey.client_email} is added in Google Analytics → Admin → Property access management as a Viewer.`,
      };
    }
    return { ok: true, message: "Saved and connected to Google Analytics." };
  }
  return { ok: true, message: "Saved." };
}
