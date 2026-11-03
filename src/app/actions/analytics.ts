"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { CLARITY_ID, GA_ID, ensureAnalyticsTable } from "@/lib/analytics/settings";

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
