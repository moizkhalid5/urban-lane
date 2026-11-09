"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { ensureMailTables } from "@/lib/mail/db";
import { encryptPassword, getMailboxes, MAILBOXES, ROLES, type MailRole } from "@/lib/mail/accounts";
import { replyTo, setSeen, syncAll, testMailbox } from "@/lib/mail/inbox";
import { sendBatch, sendOne, startCampaign, unsubscribe, validUnsubscribe } from "@/lib/mail/marketing";

export type MailResult = { ok: boolean; message?: string; id?: string };

const fail = (err: unknown): MailResult => ({ ok: false, message: err instanceof Error ? err.message : String(err) });

// ── Settings → Email ─────────────────────────────────────────────────────────

const mailboxSchema = z.object({
  address: z.enum(MAILBOXES),
  displayName: z.string().trim().min(1, "Enter the name people see.").max(80),
  /** empty = keep the saved password */
  password: z.string().max(200).optional(),
  clear: z.boolean().optional(),
});

export async function saveMailbox(input: unknown): Promise<MailResult> {
  const user = await requireAdmin();
  const parsed = mailboxSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details." };
  const { address, displayName, password, clear } = parsed.data;
  await ensureMailTables();
  const pw = clear ? null : password ? encryptPassword(password) : undefined;
  await prisma.mailAccount.upsert({
    where: { address },
    update: { displayName, ...(pw !== undefined ? { password: pw, lastError: null } : {}) },
    create: { address, displayName, password: pw ?? null },
  });
  await logAudit(user.id, "settings.mailbox", "MailAccount", address, { displayName, password: clear ? "removed" : password ? "changed" : "kept" });
  revalidatePath("/admin/settings");
  if (!password || clear) return { ok: true, message: clear ? "Password removed." : "Saved." };
  const box = (await getMailboxes()).find((b) => b.address === address)!;
  const test = await testMailbox({ ...box, password });
  return { ok: test.ok, message: test.ok ? `Saved. ${test.message}` : `Saved, but it couldn't connect. ${test.message}` };
}

export async function checkMailbox(address: string): Promise<MailResult> {
  await requireAdmin();
  const box = (await getMailboxes()).find((b) => b.address === address);
  if (!box?.password) return { ok: false, message: "Add the password first." };
  return testMailbox(box);
}

export async function saveMailRoles(input: unknown): Promise<MailResult> {
  const user = await requireAdmin();
  const parsed = z.record(z.string(), z.enum(MAILBOXES)).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a mailbox for each job." };
  const roles: Partial<Record<MailRole, string>> = {};
  for (const r of ROLES) if (parsed.data[r.role]) roles[r.role] = parsed.data[r.role];
  await ensureMailTables();
  const json = JSON.stringify(roles);
  await prisma.mailSettings.upsert({ where: { id: "singleton" }, update: { roles: json }, create: { id: "singleton", roles: json } });
  await logAudit(user.id, "settings.mail_roles", "MailSettings", "singleton", roles);
  revalidatePath("/admin/settings");
  return { ok: true, message: "Saved." };
}

// ── Inbox ────────────────────────────────────────────────────────────────────

export async function refreshInbox(): Promise<MailResult> {
  await requireAdmin();
  try {
    const added = await syncAll(0);
    revalidatePath("/admin/inbox");
    return { ok: true, message: added ? `${added} new ${added === 1 ? "email" : "emails"}.` : "No new email." };
  } catch (err) {
    return fail(err);
  }
}

export async function markEmail(id: string, read: boolean): Promise<MailResult> {
  await requireAdmin();
  await setSeen(id, read);
  revalidatePath("/admin/inbox");
  return { ok: true };
}

export async function sendReply(id: string, body: unknown): Promise<MailResult> {
  const user = await requireAdmin();
  const text = z.string().trim().min(1, "Write your reply first.").max(20000).safeParse(body);
  if (!text.success) return { ok: false, message: text.error.issues[0]?.message };
  try {
    const { to } = await replyTo(id, text.data);
    await logAudit(user.id, "inbox.reply", "MailMessage", id, { to });
    revalidatePath("/admin/inbox");
    return { ok: true, message: `Reply sent to ${to}.` };
  } catch (err) {
    return fail(err);
  }
}

// ── Marketing ────────────────────────────────────────────────────────────────

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || /^(https?:\/\/|\/)/i.test(v), "Links start with https:// or /")
  .optional()
  .transform((v) => v || null);

const campaignSchema = z.object({
  id: z.string().optional(),
  subject: z.string().trim().min(1, "Write a subject line.").max(200),
  preheader: z.string().trim().max(200).optional().transform((v) => v || null),
  heading: z.string().trim().min(1, "Write a heading.").max(200),
  body: z.string().trim().min(1, "Write the message.").max(20000),
  imageUrl: optionalUrl,
  buttonText: z.string().trim().max(60).optional().transform((v) => v || null),
  buttonUrl: optionalUrl,
  audience: z.enum(["subscribers", "customers", "both"]),
});

export async function saveCampaign(input: unknown): Promise<MailResult> {
  const user = await requireAdmin();
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the campaign." };
  const { id, ...data } = parsed.data;
  if (!!data.buttonText !== !!data.buttonUrl) return { ok: false, message: "A button needs both its text and its link." };
  await ensureMailTables();
  if (id) {
    const existing = await prisma.marketingCampaign.findUnique({ where: { id }, select: { status: true } });
    if (!existing) return { ok: false, message: "Campaign not found." };
    if (existing.status !== "DRAFT") return { ok: false, message: "This campaign has been sent, so it can't be changed." };
    await prisma.marketingCampaign.update({ where: { id }, data });
  }
  const saved = id ? { id } : await prisma.marketingCampaign.create({ data, select: { id: true } });
  await logAudit(user.id, id ? "marketing.update" : "marketing.create", "MarketingCampaign", saved.id, { subject: data.subject });
  revalidatePath("/admin/marketing");
  return { ok: true, message: "Saved.", id: saved.id };
}

export async function sendCampaignTest(id: string, to: unknown): Promise<MailResult> {
  await requireAdmin();
  const email = z.string().trim().email("Enter an email address.").safeParse(to);
  if (!email.success) return { ok: false, message: email.error.issues[0]?.message };
  const c = await prisma.marketingCampaign.findUnique({ where: { id } });
  if (!c) return { ok: false, message: "Save the campaign first." };
  try {
    await sendOne({ ...c, subject: `[Test] ${c.subject}` }, email.data);
    return { ok: true, message: `Test sent to ${email.data}.` };
  } catch (err) {
    return fail(err);
  }
}

export async function startCampaignSend(id: string): Promise<MailResult & { total?: number }> {
  const user = await requireAdmin();
  try {
    const total = await startCampaign(id);
    await logAudit(user.id, "marketing.send", "MarketingCampaign", id, { recipients: total });
    return { ok: true, total };
  } catch (err) {
    return fail(err);
  }
}

export async function sendCampaignBatch(id: string) {
  await requireAdmin();
  try {
    const r = await sendBatch(id);
    if (r.done) revalidatePath("/admin/marketing");
    return { ok: true as const, ...r };
  } catch (err) {
    return { ok: false as const, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteCampaign(id: string): Promise<MailResult> {
  const user = await requireAdmin();
  const c = await prisma.marketingCampaign.findUnique({ where: { id }, select: { status: true, subject: true } });
  if (!c) return { ok: false, message: "Campaign not found." };
  if (c.status !== "DRAFT") return { ok: false, message: "Sent campaigns are kept as a record." };
  await prisma.marketingCampaign.delete({ where: { id } });
  await logAudit(user.id, "marketing.delete", "MarketingCampaign", id, { subject: c.subject });
  revalidatePath("/admin/marketing");
  return { ok: true };
}

// ── Unsubscribe (public) ─────────────────────────────────────────────────────

export async function unsubscribeAction(email: string, token: string): Promise<MailResult> {
  const limit = rateLimit(await clientKey("unsubscribe"), 20, 15 * 60 * 1000);
  if (!limit.ok) return { ok: false, message: "Too many attempts. Please try again later." };
  if (!email || !token || !validUnsubscribe(email, token)) return { ok: false, message: "This unsubscribe link isn't valid." };
  await ensureMailTables();
  await unsubscribe(email);
  return { ok: true, message: "You've been unsubscribed. You won't get marketing emails from Urban Lane any more." };
}

