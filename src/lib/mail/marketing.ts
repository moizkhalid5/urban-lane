import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import type { MarketingCampaign } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/site";
import { mailboxFor } from "./accounts";
import { mailboxTransport } from "@/lib/email";
import { ensureMailTables } from "./db";

/**
 * Admin → Marketing: campaigns sent from the marketing mailbox (manager@) to people who agreed to hear
 * from the shop: newsletter subscribers, and customers who ticked "email me offers" when signing up.
 * Every email has its own unsubscribe link (and the List-Unsubscribe header mail apps show as a button);
 * unsubscribing takes the address off both lists. Sent in small batches so a long list never times out.
 */

export type Audience = "subscribers" | "customers" | "both";
export const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "both", label: "Everyone who agreed to marketing emails" },
  { value: "subscribers", label: "Newsletter subscribers" },
  { value: "customers", label: "Customers who ticked marketing emails at sign-up" },
];

const norm = (e: string) => e.trim().toLowerCase();

/** The addresses a campaign goes to, without duplicates. */
export async function audienceEmails(audience: Audience): Promise<string[]> {
  const out = new Set<string>();
  if (audience !== "customers") {
    const subs = await prisma.newsletterSubscriber.findMany({ where: { isActive: true }, select: { email: true } });
    subs.forEach((s) => out.add(norm(s.email)));
  }
  if (audience !== "subscribers") {
    const users = await prisma.user.findMany({ where: { profile: { acceptsMarketing: true } }, select: { email: true } });
    users.forEach((u) => u.email && out.add(norm(u.email)));
  }
  return [...out].filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

export async function audienceCounts(): Promise<Record<Audience, number>> {
  const [subscribers, customers, both] = await Promise.all([
    audienceEmails("subscribers"),
    audienceEmails("customers"),
    audienceEmails("both"),
  ]);
  return { subscribers: subscribers.length, customers: customers.length, both: both.length };
}

// ── unsubscribing ────────────────────────────────────────────────────────────

const sign = (email: string) => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`unsubscribe:${norm(email)}`).digest("base64url").slice(0, 32);
};

export const unsubscribeUrl = (email: string) =>
  `${APP_URL}/unsubscribe?e=${encodeURIComponent(norm(email))}&t=${sign(email)}`;

export function validUnsubscribe(email: string, token: string): boolean {
  const a = Buffer.from(sign(email));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Takes an address off the newsletter and the customers' marketing list. */
export async function unsubscribe(email: string): Promise<void> {
  const e = norm(email);
  await prisma.newsletterSubscriber.updateMany({ where: { email: e }, data: { isActive: false } });
  await prisma.customerProfile.updateMany({ where: { user: { email: e } }, data: { acceptsMarketing: false } });
}

// ── the email ────────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const absolute = (url: string) => (/^https?:\/\//i.test(url) ? url : `${APP_URL}${url.startsWith("/") ? "" : "/"}${url}`);

type CampaignContent = Pick<MarketingCampaign, "subject" | "preheader" | "heading" | "body" | "imageUrl" | "buttonText" | "buttonUrl">;

/** The campaign as one recipient gets it. */
export function campaignEmail(c: CampaignContent, email: string) {
  const unsub = unsubscribeUrl(email);
  const paragraphs = c.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const bodyHtml = paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#333">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const image = c.imageUrl
    ? `<tr><td><img src="${esc(absolute(c.imageUrl))}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0"></td></tr>`
    : "";
  const button =
    c.buttonText && c.buttonUrl
      ? `<p style="margin:24px 0 0"><a href="${esc(absolute(c.buttonUrl))}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 28px;font-size:14px;text-transform:uppercase;letter-spacing:.5px">${esc(c.buttonText)}</a></p>`
      : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#111">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.preheader ?? "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e7e7e7;max-width:560px">
<tr><td style="padding:24px 32px;border-bottom:1px solid #e7e7e7;text-align:center">
<a href="${APP_URL}" style="font-size:20px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#111;text-decoration:none">Urban Lane</a></td></tr>
${image}
<tr><td style="padding:32px">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:600">${esc(c.heading)}</h1>
${bodyHtml}${button}
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e7e7e7;font-size:12px;line-height:1.6;color:#6b6b6b">
You're receiving this because you signed up for emails from Urban Lane.
<a href="${unsub}" style="color:#6b6b6b">Unsubscribe</a> · <a href="${APP_URL}" style="color:#6b6b6b">${APP_URL.replace(/^https?:\/\//, "")}</a>
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    c.heading,
    "",
    ...paragraphs,
    ...(c.buttonText && c.buttonUrl ? ["", `${c.buttonText}: ${absolute(c.buttonUrl)}`] : []),
    "",
    `Unsubscribe: ${unsub}`,
  ].join("\n");
  return {
    subject: c.subject,
    html,
    text,
    // one-click unsubscribe (RFC 8058): mail apps show it as an "Unsubscribe" button and POST to it
    headers: { "List-Unsubscribe": `<${unsub.replace("/unsubscribe?", "/api/unsubscribe?")}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

// ── sending ──────────────────────────────────────────────────────────────────

export async function marketingMailbox() {
  const box = await mailboxFor("marketing");
  if (!box) throw new Error("The marketing mailbox isn't set up yet: add its password in Settings → Email.");
  return box;
}

export async function sendOne(c: CampaignContent, to: string): Promise<void> {
  const box = await marketingMailbox();
  await mailboxTransport(box).sendMail({ from: { name: box.displayName, address: box.address }, to, ...campaignEmail(c, to) });
}

/** Queues everyone in the campaign's audience (once) and marks it as sending. Returns how many. */
export async function startCampaign(id: string): Promise<number> {
  await ensureMailTables();
  const c = await prisma.marketingCampaign.findUniqueOrThrow({ where: { id } });
  if (c.status === "DRAFT") {
    const emails = await audienceEmails(c.audience as Audience);
    if (emails.length === 0) throw new Error("Nobody is on that list yet.");
    await prisma.marketingSend.createMany({ data: emails.map((email) => ({ campaignId: id, email })), skipDuplicates: true });
    await prisma.marketingCampaign.update({ where: { id }, data: { status: "SENDING" } });
  }
  return prisma.marketingSend.count({ where: { campaignId: id } });
}

/** Sends the next few queued emails. Returns what is left, so the admin page can keep going. */
export async function sendBatch(id: string, size = 15): Promise<{ sent: number; failed: number; queued: number; done: boolean }> {
  const c = await prisma.marketingCampaign.findUniqueOrThrow({ where: { id } });
  if (c.status !== "SENDING") throw new Error("This campaign isn't sending.");
  await marketingMailbox();
  const batch = await prisma.marketingSend.findMany({ where: { campaignId: id, status: "QUEUED" }, take: size });
  for (const r of batch) {
    try {
      await sendOne(c, r.email);
      await prisma.marketingSend.update({ where: { id: r.id }, data: { status: "SENT", error: null } });
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
      await prisma.marketingSend.update({ where: { id: r.id }, data: { status: "FAILED", error: message } });
    }
  }
  const [sent, failed, queued] = await Promise.all([
    prisma.marketingSend.count({ where: { campaignId: id, status: "SENT" } }),
    prisma.marketingSend.count({ where: { campaignId: id, status: "FAILED" } }),
    prisma.marketingSend.count({ where: { campaignId: id, status: "QUEUED" } }),
  ]);
  const done = queued === 0;
  await prisma.marketingCampaign.update({
    where: { id },
    data: { sentCount: sent, failCount: failed, ...(done ? { status: "SENT", sentAt: new Date() } : {}) },
  });
  return { sent, failed, queued, done };
}
