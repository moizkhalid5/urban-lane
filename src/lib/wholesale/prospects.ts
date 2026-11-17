import "server-only";
import MailComposer from "nodemailer/lib/mail-composer";
import type { Prisma, WholesaleProspect } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mailboxTransport } from "@/lib/email";
import { getMailboxes, mailboxFor } from "@/lib/mail/accounts";
import { ensureMailTables } from "@/lib/mail/db";
import { saveToSent } from "@/lib/mail/inbox";
import { ensureWholesaleTables } from "./db";

/**
 * Admin → Wholesale: the stores and brands we pitch our stock to in bulk, and every conversation with them.
 * Prospects come from the research sheet (imported as a JSON file) or are added by hand. Emails are really
 * sent from a shop mailbox and their replies, read into Admin → Inbox, appear in the same thread; WhatsApp
 * opens with the pitch filled in (there is no WhatsApp API for us), and replies are pasted in.
 */

import { STAGES, stageOf, type Stage } from "./stages";
export { STAGES, stageOf, type Stage };
const OPEN: Stage[] = ["NEW", "CONTACTED", "REPLIED", "NEGOTIATING"];

export const PRIORITIES = ["High", "Medium", "Low", "Check first"] as const;
const priorityRank = (p: string) => {
  const i = (PRIORITIES as readonly string[]).indexOf(p);
  return i < 0 ? PRIORITIES.length : i;
};

/* ---------- settings ---------- */

export type Tier = { name: string; minPieces: string; discount: string; notes: string };
export type WholesaleSettings = {
  /** fills [Your name] in pitches */
  yourName: string;
  /** fills [Your WhatsApp number] in pitches */
  yourWhatsApp: string;
  /** mailbox emails are sent from ("" = the marketing mailbox) */
  mailbox: string;
  /** link to the wholesale list (Drive/Dropbox/PDF), offered in pitches */
  listUrl: string;
  /** days until the follow-up after a first message (the guide: call after 2 days) */
  followUpDays: number;
  tiers: Tier[];
};
const DEFAULT_SETTINGS: WholesaleSettings = {
  yourName: "",
  yourWhatsApp: "",
  mailbox: "",
  listUrl: "",
  followUpDays: 2,
  tiers: [
    { name: "Tier 1", minPieces: "", discount: "", notes: "" },
    { name: "Tier 2", minPieces: "", discount: "", notes: "" },
    { name: "Tier 3", minPieces: "", discount: "", notes: "" },
  ],
};

export async function getWholesaleSettings(): Promise<WholesaleSettings> {
  await ensureWholesaleTables();
  const row = await prisma.wholesaleSettings.findUnique({ where: { id: "singleton" } });
  try {
    return { ...DEFAULT_SETTINGS, ...(row ? (JSON.parse(row.data) as Partial<WholesaleSettings>) : {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveWholesaleSettings(s: WholesaleSettings) {
  await ensureWholesaleTables();
  const data = JSON.stringify(s);
  await prisma.wholesaleSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", data }, update: { data } });
}

/** The mailbox wholesale emails go out from: the one chosen in settings, else the marketing mailbox. */
export async function wholesaleMailbox() {
  const s = await getWholesaleSettings();
  const chosen = s.mailbox ? (await getMailboxes()).find((b) => b.address === s.mailbox && b.password) : null;
  return chosen ?? (await mailboxFor("marketing"));
}

/* ---------- pitches and links ---------- */

/** The pitch with your name, WhatsApp number and list link filled in (placeholders stay if not set). */
export function personalise(text: string, s: WholesaleSettings) {
  let out = text;
  if (s.yourName.trim()) out = out.replace(/\[Your name\]/gi, s.yourName.trim());
  if (s.yourWhatsApp.trim()) out = out.replace(/\[Your WhatsApp number\]/gi, s.yourWhatsApp.trim());
  if (s.listUrl.trim()) out = out.replace(/\[(Wholesale|Our wholesale) list link\]/gi, s.listUrl.trim());
  return out;
}

/** A pitch for a prospect with none: built from what we know about them. */
export function defaultPitch(p: Pick<WholesaleProspect, "name" | "ourBrands">) {
  const brands = (p.ourBrands ?? "").split(",").map((b) => b.trim()).filter(Boolean);
  const named = brands.length > 4 ? `${brands.slice(0, 4).join(", ")} and ${brands.length - 4} more of our brands` : brands.join(", ");
  return `Assalam-o-Alaikum ${p.name} team,

I'm [Your name] from Urban Lane, a Pakistan-based seller of original UK high-street brands.${
    named ? ` I saw you sell ${named}, which we also stock.` : ""
  }

We hold the stock here in Pakistan, so there's no import, customs or waiting. We offer discounted rates on bulk orders, and the more you take, the better the price. We can also make up a mixed lot to suit your range.

Can I send you our wholesale list with photos and prices on WhatsApp?

[Your name] | Urban Lane | [Your WhatsApp number]`;
}

/** wa.me link for a prospect's WhatsApp (a number in any format, or a wa.me link they publish). */
export function whatsappLink(whatsapp: string | null | undefined, text?: string) {
  const raw = (whatsapp ?? "").trim();
  if (!raw) return null;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(raw)) {
    // a wa.me/message/... short link can't carry text: open it as it is
    return /wa\.me\/message\//i.test(raw) ? raw : `${raw.split("?")[0]}${q}`;
  }
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`; // Pakistani local number
  return digits.length >= 10 ? `https://wa.me/${digits}${q}` : null;
}

/** tel: link (spaces and dashes removed). */
export const telLink = (phone: string | null | undefined) => (phone?.trim() ? `tel:${phone.replace(/[^\d+]/g, "")}` : null);

/* ---------- import ---------- */

type ImportRow = Partial<Record<keyof WholesaleProspect, unknown>>;
const str = (v: unknown, max = 5000) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim().slice(0, max));
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
const hostOf = (url: string | null) => (url ? url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").toLowerCase() : null);

/**
 * Loads prospects from the research file ({ "prospects": [...] }). A store already here (same website, or
 * same name) gets its research fields refreshed; its stage, follow-up and conversation are left alone.
 */
export async function importProspects(json: unknown) {
  await ensureWholesaleTables();
  const list = (json as { prospects?: unknown })?.prospects;
  if (!Array.isArray(list)) throw new Error('The file needs a "prospects" list.');
  const existing = await prisma.wholesaleProspect.findMany({ select: { id: true, name: true, website: true } });
  let added = 0;
  let updated = 0;
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
    if (match) {
      await prisma.wholesaleProspect.update({ where: { id: match.id }, data });
      updated += 1;
    } else {
      const made = await prisma.wholesaleProspect.create({ data });
      existing.push({ id: made.id, name: made.name, website: made.website });
      added += 1;
    }
  }
  return { added, updated };
}

/* ---------- conversation ---------- */

export type Kind = "WHATSAPP" | "EMAIL" | "CALL" | "NOTE" | "STAGE";
export type Direction = "OUT" | "IN" | "NONE";

/**
 * Adds to the conversation and moves the prospect along: a first message out makes a new prospect
 * "Contacted" and sets a follow-up; a reply in makes a contacted prospect "Replied".
 */
export async function logActivity(
  prospectId: string,
  a: { kind: Kind; direction: Direction; body: string; subject?: string | null; messageId?: string | null },
  author?: string | null,
) {
  await ensureWholesaleTables();
  const [p, s] = await Promise.all([prisma.wholesaleProspect.findUniqueOrThrow({ where: { id: prospectId } }), getWholesaleSettings()]);
  const data: Prisma.WholesaleProspectUpdateInput = {};
  const now = new Date();
  if (a.direction === "OUT" && a.kind !== "NOTE") {
    data.lastContactAt = now;
    if (p.stage === "NEW") data.stage = "CONTACTED";
    if (!p.followUpAt || p.followUpAt < now) data.followUpAt = new Date(now.getTime() + Math.max(1, s.followUpDays) * 86400_000);
  }
  if (a.direction === "IN") {
    data.lastContactAt = now;
    if (p.stage === "NEW" || p.stage === "CONTACTED") data.stage = "REPLIED";
    data.followUpAt = now; // their reply needs an answer: due now
  }
  await prisma.$transaction([
    prisma.wholesaleActivity.create({
      data: { prospectId, kind: a.kind, direction: a.direction, body: a.body.trim().slice(0, 20000), subject: a.subject ?? null, messageId: a.messageId ?? null, author: author ?? null },
    }),
    ...(Object.keys(data).length ? [prisma.wholesaleProspect.update({ where: { id: prospectId }, data })] : []),
  ]);
}

export async function setStage(prospectId: string, stage: Stage, author?: string | null) {
  await ensureWholesaleTables();
  const p = await prisma.wholesaleProspect.findUniqueOrThrow({ where: { id: prospectId } });
  if (p.stage === stage) return;
  await prisma.$transaction([
    prisma.wholesaleProspect.update({ where: { id: prospectId }, data: { stage, ...(stage === "WON" || stage === "LOST" ? { followUpAt: null } : {}) } }),
    prisma.wholesaleActivity.create({
      data: { prospectId, kind: "STAGE", direction: "NONE", body: `${stageOf(p.stage).label} → ${stageOf(stage).label}`, author: author ?? null },
    }),
  ]);
}

/** Sends an email to the prospect from the wholesale mailbox, keeps a copy in Sent, and logs it. */
export async function emailProspect(prospectId: string, subject: string, body: string, author?: string | null) {
  await Promise.all([ensureWholesaleTables(), ensureMailTables()]);
  const p = await prisma.wholesaleProspect.findUniqueOrThrow({ where: { id: prospectId } });
  if (!p.email) throw new Error("This store has no email address. Add one under Contact details.");
  const box = await wholesaleMailbox();
  if (!box?.password) throw new Error("No mailbox is set up for sending: add its password in Settings → Email.");
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const to = p.email.split(/[;,\s]+/)[0];
  const domain = box.address.split("@")[1];
  const messageId = `<wholesale.${p.id}.${Date.now()}@${domain}>`;
  const mail = {
    from: { name: box.displayName, address: box.address },
    to,
    subject: subject.trim() || `Wholesale: original UK brands from Urban Lane`,
    text: body.trim(),
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;white-space:pre-wrap">${esc(body.trim())}</div>`,
    messageId,
  };
  const raw = await new MailComposer(mail).compile().build();
  await mailboxTransport(box).sendMail({ envelope: { from: box.address, to: [to] }, raw });
  await saveToSent(box, raw);
  await logActivity(prospectId, { kind: "EMAIL", direction: "OUT", subject: mail.subject, body, messageId }, author);
  return { to, from: box.address };
}

export type ThreadItem = {
  id: string;
  kind: Kind | "EMAIL";
  direction: Direction;
  subject: string | null;
  body: string;
  at: Date;
  author: string | null;
  /** an email that arrived in Admin → Inbox */
  inboxId?: string;
};

/** Everything with this prospect, oldest first: logged messages, calls and notes, plus their emails in the Inbox. */
export async function threadFor(p: Pick<WholesaleProspect, "id" | "email">): Promise<ThreadItem[]> {
  await ensureWholesaleTables();
  const emails = (p.email ?? "")
    .split(/[;,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
  const [acts, inbox] = await Promise.all([
    prisma.wholesaleActivity.findMany({ where: { prospectId: p.id }, orderBy: { createdAt: "asc" } }),
    emails.length
      ? ensureMailTables()
          .then(() =>
            prisma.mailMessage.findMany({
              where: { OR: [{ fromAddress: { in: emails } }, { replyTo: { in: emails } }] },
              orderBy: { date: "asc" },
              select: { id: true, subject: true, text: true, snippet: true, date: true, fromName: true },
            }),
          )
          .catch(() => [])
      : Promise.resolve([]),
  ]);
  return [
    ...acts.map((a) => ({ id: a.id, kind: a.kind as Kind, direction: a.direction as Direction, subject: a.subject, body: a.body, at: a.createdAt, author: a.author })),
    ...inbox.map((m) => ({
      id: `mail-${m.id}`,
      kind: "EMAIL" as const,
      direction: "IN" as const,
      subject: m.subject,
      body: (m.text ?? m.snippet).split(/\n>|\nOn .{5,80} wrote:/)[0].trim(),
      at: m.date,
      author: m.fromName,
      inboxId: m.id,
    })),
  ].sort((a, b) => +a.at - +b.at);
}

/**
 * An email from a store we've contacted, arriving after our last message, counts as their reply: the store
 * moves to "Replied" and is due for an answer. (Older emails, or from stores we haven't contacted, don't.)
 */
export async function catchUpEmailReplies() {
  await Promise.all([ensureWholesaleTables(), ensureMailTables()]);
  const open = await prisma.wholesaleProspect.findMany({
    where: { stage: "CONTACTED", email: { not: null }, lastContactAt: { not: null } },
    select: { id: true, email: true, lastContactAt: true },
  });
  for (const p of open) {
    const emails = (p.email ?? "").split(/[;,\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"));
    if (!emails.length) continue;
    const reply = await prisma.mailMessage.findFirst({
      where: { OR: [{ fromAddress: { in: emails } }, { replyTo: { in: emails } }], date: { gt: p.lastContactAt! } },
      select: { date: true },
    });
    if (reply) await prisma.wholesaleProspect.update({ where: { id: p.id }, data: { stage: "REPLIED", lastContactAt: reply.date, followUpAt: new Date() } });
  }
}

/* ---------- lists ---------- */

export type ProspectFilter = { q?: string; stage?: string; priority?: string; segment?: string; due?: boolean };

export async function listProspects(f: ProspectFilter = {}) {
  await ensureWholesaleTables();
  const q = f.q?.trim();
  const rows = await prisma.wholesaleProspect.findMany({
    where: {
      ...(f.stage && { stage: f.stage }),
      ...(f.priority && { priority: f.priority }),
      ...(f.segment && { segments: { contains: f.segment } }),
      ...(f.due && { followUpAt: { lte: endOfToday() }, stage: { in: OPEN } }),
      ...(q && {
        OR: [{ name: { contains: q } }, { city: { contains: q } }, { ourBrands: { contains: q } }, { website: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }],
      }),
    },
    include: { _count: { select: { activities: true } } },
  });
  return rows.sort(
    (a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.brandsInCommon - a.brandsInCommon || b.unitsInBrands - a.unitsInBrands || (a.ref ?? 999) - (b.ref ?? 999),
  );
}

/** End of today in Pakistan time. */
export function endOfToday() {
  const pk = new Date(Date.now() + 5 * 3600_000);
  return new Date(Date.UTC(pk.getUTCFullYear(), pk.getUTCMonth(), pk.getUTCDate(), 23 - 5, 59, 59));
}

export async function wholesaleStats() {
  await ensureWholesaleTables();
  const [byStage, due, total] = await Promise.all([
    prisma.wholesaleProspect.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.wholesaleProspect.count({ where: { followUpAt: { lte: endOfToday() }, stage: { in: OPEN } } }),
    prisma.wholesaleProspect.count(),
  ]);
  const count = (s: Stage) => byStage.find((x) => x.stage === s)?._count._all ?? 0;
  return { total, due, stages: Object.fromEntries(STAGES.map((s) => [s.key, count(s.key)])) as Record<Stage, number> };
}

/** The next prospect to contact after this one: highest priority still "To contact". */
export async function nextToContact(afterId?: string) {
  const list = await listProspects({ stage: "NEW" });
  return list.find((p) => p.id !== afterId && p.priority !== "Check first") ?? list.find((p) => p.id !== afterId) ?? null;
}
