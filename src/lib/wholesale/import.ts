import "server-only";
import type { WholesaleProspect } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureWholesaleTables } from "./db";

/**
 * Loading the wholesale research file into Admin → Wholesale. Kept apart from prospects.ts (which sends
 * email) so the one-time loader at server start (lib/wholesale/seed.ts) doesn't pull in the mail libraries.
 */

export const PRIORITIES = ["High", "Medium", "Low", "Check first"] as const;

/* ---------- import ---------- */

type ImportRow = Partial<Record<keyof WholesaleProspect, unknown>>;
const str = (v: unknown, max = 5000) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim().slice(0, max));
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
const hostOf = (url: string | null) => (url ? url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").toLowerCase() : null);

/**
 * Loads prospects from the research file ({ "prospects": [...] }). A store already here (same website, or
 * same name) gets its research fields refreshed; its stage, follow-up and conversation are left alone.
 * With `onlyNew`, a store already here is skipped instead (nothing about it changes).
 */
export async function importProspects(json: unknown, { onlyNew = false } = {}) {
  await ensureWholesaleTables();
  const list = (json as { prospects?: unknown })?.prospects;
  if (!Array.isArray(list)) throw new Error('The file needs a "prospects" list.');
  const existing = await prisma.wholesaleProspect.findMany({ select: { id: true, name: true, website: true } });
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const r of list as ImportRow[]) {
    const name = str(r.name, 200);
    if (!name) continue;
    const data = {
      ref: r.ref == null ? null : int(r.ref),
      name,
      website: str(r.website, 300),
      segments: str(r.segments, 300),
      stockType: str(r.stockType, 120),
      shopType: str(r.shopType, 60),
      city: str(r.city, 120),
      address: str(r.address, 500),
      phone: str(r.phone, 60),
      whatsapp: str(r.whatsapp, 200),
      email: str(r.email, 320),
      instagram: str(r.instagram, 300),
      facebook: str(r.facebook, 300),
      tiktok: str(r.tiktok, 300),
      otherContacts: str(r.otherContacts),
      ourBrands: str(r.ourBrands),
      brandsInCommon: int(r.brandsInCommon),
      unitsInBrands: int(r.unitsInBrands),
      priority: (PRIORITIES as readonly string[]).includes(String(r.priority)) ? String(r.priority) : "Medium",
      pitchAngle: str(r.pitchAngle, 120),
      stockToOffer: str(r.stockToOffer),
      pitch: str(r.pitch),
      theirBrands: str(r.theirBrands),
      whatTheySell: str(r.whatTheySell),
      notes: str(r.notes),
      caution: str(r.caution),
      evidence: str(r.evidence),
    };
    const host = hostOf(data.website);
    const match = existing.find((e) => (host && hostOf(e.website) === host) || e.name.toLowerCase() === name.toLowerCase());
    if (match && onlyNew) {
      skipped += 1;
    } else if (match) {
      await prisma.wholesaleProspect.update({ where: { id: match.id }, data });
      updated += 1;
    } else {
      const made = await prisma.wholesaleProspect.create({ data });
      existing.push({ id: made.id, name: made.name, website: made.website });
      added += 1;
    }
  }
  return { added, updated, skipped };
}
