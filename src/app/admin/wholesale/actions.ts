"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { ensureWholesaleTables } from "@/lib/wholesale/db";
import {
  emailProspect,
  getWholesaleSettings,
  importProspects,
  logActivity,
  saveWholesaleSettings,
  setStage,
  STAGES,
  type Direction,
  type Kind,
  type Stage,
} from "@/lib/wholesale/prospects";

/** Server actions for Admin → Wholesale (admins only). */

const back = (id?: string) => {
  revalidatePath("/admin/wholesale");
  if (id) revalidatePath(`/admin/wholesale/${id}`);
};
const field = (f: FormData, k: string, max = 5000) => {
  const v = String(f.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};

export type ActionResult = { ok: boolean; message: string };

/** WhatsApp opened with this text (the link opens in the browser; this records it). */
export async function logWhatsApp(prospectId: string, text: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!text.trim()) return { ok: false, message: "Write a message first." };
  await logActivity(prospectId, { kind: "WHATSAPP", direction: "OUT", body: text }, user.email);
  back(prospectId);
  return { ok: true, message: "Recorded as sent on WhatsApp." };
}

export async function sendEmailAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = String(f.get("prospectId"));
  try {
    const r = await emailProspect(id, String(f.get("subject") ?? ""), String(f.get("body") ?? ""), user.email);
    back(id);
    return { ok: true, message: `Sent to ${r.to} from ${r.from}. Their reply will appear here once it reaches the Inbox.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "The email couldn't be sent." };
  }
}

/** A reply they sent (pasted from WhatsApp, or what they said on a call), a call we made, or a note. */
export async function logEntryAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const id = String(f.get("prospectId"));
  const body = field(f, "body", 20000);
  if (!body) return { ok: false, message: "Write something first." };
  const kind = (["WHATSAPP", "EMAIL", "CALL", "NOTE"].includes(String(f.get("kind"))) ? f.get("kind") : "NOTE") as Kind;
  const direction = (["OUT", "IN", "NONE"].includes(String(f.get("direction"))) ? f.get("direction") : "NONE") as Direction;
  await logActivity(id, { kind, direction, body }, user.email);
  back(id);
  return { ok: true, message: direction === "IN" ? "Their reply is saved." : kind === "NOTE" ? "Note saved." : "Saved." };
}

export async function setStageAction(f: FormData) {
  const user = await requireAdmin();
  const id = String(f.get("prospectId"));
  const stage = String(f.get("stage")) as Stage;
  if (STAGES.some((s) => s.key === stage)) await setStage(id, stage, user.email);
  back(id);
}

/** Follow-up date (or a quick "in N days") and the next step. */
export async function followUpAction(f: FormData) {
  await requireAdmin();
  const id = String(f.get("prospectId"));
  const inDays = Number(f.get("inDays"));
  const date = field(f, "date", 20);
  const clear = f.get("clear") === "1";
  const followUpAt = clear ? null : inDays ? new Date(Date.now() + inDays * 86400_000) : date ? new Date(`${date}T10:00:00+05:00`) : undefined;
  await prisma.wholesaleProspect.update({
    where: { id },
    data: { ...(followUpAt !== undefined && { followUpAt }), ...(f.has("nextStep") && { nextStep: field(f, "nextStep", 300) }) },
  });
  back(id);
}

/** Contact details and notes, edited on the store's page. */
export async function updateProspectAction(f: FormData) {
  await requireAdmin();
  const id = String(f.get("prospectId"));
  await prisma.wholesaleProspect.update({
    where: { id },
    data: {
      name: field(f, "name", 200) ?? undefined,
      website: field(f, "website", 300),
      city: field(f, "city", 120),
      phone: field(f, "phone", 60),
      whatsapp: field(f, "whatsapp", 200),
      email: field(f, "email", 320),
      instagram: field(f, "instagram", 300),
      facebook: field(f, "facebook", 300),
      priority: field(f, "priority", 20) ?? undefined,
      pitch: field(f, "pitch", 10000),
    },
  });
  back(id);
}

export async function addProspectAction(f: FormData) {
  await requireAdmin();
  await ensureWholesaleTables();
  const name = field(f, "name", 200);
  if (!name) redirect("/admin/wholesale?msg=" + encodeURIComponent("Give the store a name."));
  const p = await prisma.wholesaleProspect.create({
    data: {
      name,
      website: field(f, "website", 300),
      city: field(f, "city", 120),
      phone: field(f, "phone", 60),
      whatsapp: field(f, "whatsapp", 200),
      email: field(f, "email", 320),
      instagram: field(f, "instagram", 300),
      ourBrands: field(f, "ourBrands"),
      priority: field(f, "priority", 20) ?? "Medium",
    },
  });
  revalidatePath("/admin/wholesale");
  redirect(`/admin/wholesale/${p.id}`);
}

export async function deleteProspectAction(f: FormData) {
  await requireAdmin();
  await prisma.wholesaleProspect.delete({ where: { id: String(f.get("prospectId")) } });
  revalidatePath("/admin/wholesale");
  redirect("/admin/wholesale?msg=" + encodeURIComponent("Store removed."));
}

export async function importAction(f: FormData) {
  await requireAdmin();
  const file = f.get("file");
  let msg: string;
  try {
    if (!(file instanceof File) || !file.size) throw new Error("Choose the prospects file first.");
    if (file.size > 900_000) throw new Error("That file is too big.");
    const r = await importProspects(JSON.parse(await file.text()));
    msg = `${r.added} store${r.added === 1 ? "" : "s"} added${r.updated ? `, ${r.updated} refreshed (their conversations kept)` : ""}.`;
  } catch (e) {
    msg = e instanceof SyntaxError ? "That isn't a prospects file (it couldn't be read)." : e instanceof Error ? e.message : "Couldn't load the file.";
  }
  revalidatePath("/admin/wholesale");
  redirect("/admin/wholesale?msg=" + encodeURIComponent(msg));
}

export async function saveSettingsAction(f: FormData) {
  await requireAdmin();
  const s = await getWholesaleSettings();
  await saveWholesaleSettings({
    ...s,
    yourName: field(f, "yourName", 80) ?? "",
    yourWhatsApp: field(f, "yourWhatsApp", 40) ?? "",
    mailbox: field(f, "mailbox", 191) ?? "",
    listUrl: field(f, "listUrl", 500) ?? "",
    followUpDays: Math.min(30, Math.max(1, Number(f.get("followUpDays")) || 2)),
    tiers: s.tiers.map((t, i) => ({
      name: field(f, `tier${i}name`, 40) ?? t.name,
      minPieces: field(f, `tier${i}min`, 20) ?? "",
      discount: field(f, `tier${i}discount`, 20) ?? "",
      notes: field(f, `tier${i}notes`, 200) ?? "",
    })),
  });
  revalidatePath("/admin/wholesale");
  redirect("/admin/wholesale/guide?saved=1");
}
