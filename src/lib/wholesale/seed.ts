import "server-only";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { ensureWholesaleTables } from "./db";
import { importProspects } from "./import";

/**
 * Research files of wholesale prospects that load into Admin → Wholesale by themselves, once each (the host
 * runs no data step after a deploy). Only stores not already there are added: a store that's already in
 * Admin → Wholesale (same website or name), e.g. imported by hand, is left exactly as it is.
 */
const SEEDS = [{ version: "prospects-nov-2026", load: () => import("./seed/prospects-nov-2026.json") }];

/** Runs at server start (src/instrumentation.ts). Best-effort. */
export async function seedWholesaleProspectsOnce(): Promise<void> {
  for (const s of SEEDS) {
    try {
      await ensureWholesaleTables();
      const done = await prisma.auditLog.findFirst({ where: { action: "wholesale.seed", entityId: s.version }, select: { id: true } });
      if (done) continue;
      const file = await s.load();
      const report = await importProspects(file.default ?? file, { onlyNew: true });
      await logAudit(undefined, "wholesale.seed", "WholesaleProspect", s.version, report);
      console.log(`[wholesale] ${s.version}: ${report.added} stores added, ${report.skipped} already there.`);
    } catch (err) {
      console.error(`[wholesale] Couldn't load ${s.version}.`, err);
    }
  }
}
