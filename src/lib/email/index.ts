import "server-only";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { addressFor, mailboxFor, MAIL_SERVER, type Mailbox, type MailRole } from "@/lib/mail/accounts";

/**
 * The shop's email.
 *
 * Each email goes out from the mailbox that does its job (`from`: orders, support, marketing, admin or
 * finance; see lib/mail/accounts), over Hostinger's SMTP with Nodemailer, once that mailbox's password is
 * saved in Admin → Settings → Email. Until then it falls back to EMAIL_PROVIDER:
 *
 * EMAIL_PROVIDER:
 *   "console" (default in dev) — logs the email to the server console.
 *   "resend"  — sends via the Resend HTTP API (set RESEND_API_KEY).
 *   "smtp"    — sends via SMTP (set SMTP_* vars; requires `nodemailer`).
 *
 * Swap providers without touching call sites: see templates in ./templates.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** which mailbox sends it (default: orders, i.e. no-reply@) */
  from?: MailRole;
  headers?: Record<string, string>;
  inReplyTo?: string;
  references?: string;
};

const FROM = process.env.EMAIL_FROM || "Urban Lane <no-reply@urbanlane.uk>";

async function sendViaResend(msg: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      reply_to: msg.replyTo,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend error ${res.status}: ${await res.text()}`);
  }
}

async function sendViaSmtp(msg: EmailMessage): Promise<void> {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  await transport.sendMail({
    // Hostinger (and most SMTP hosts) reject mail whose From differs from the login mailbox.
    from: process.env.EMAIL_FROM || (process.env.SMTP_USER ? `Urban Lane <${process.env.SMTP_USER}>` : FROM),
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo: msg.replyTo,
    headers: msg.headers,
    inReplyTo: msg.inReplyTo,
    references: msg.references,
  });
}

// ── the shop's own mailboxes ───────────────────────────────────────────────────

/** One reusable SMTP connection pool per mailbox (a campaign sends many emails through one login). */
const transports = new Map<string, nodemailer.Transporter<SMTPTransport.SentMessageInfo>>();
export function mailboxTransport(box: Mailbox) {
  const key = `${box.address}:${box.password}`;
  let t = transports.get(key);
  if (!t) {
    t = nodemailer.createTransport({
      host: MAIL_SERVER.smtpHost,
      port: MAIL_SERVER.smtpPort,
      secure: MAIL_SERVER.smtpSecure,
      auth: { user: box.address, pass: box.password! },
      pool: true,
      maxConnections: 2,
    } as SMTPTransport.Options);
    for (const [k, old] of transports) if (k.startsWith(`${box.address}:`)) { old.close(); transports.delete(k); }
    transports.set(key, t);
  }
  return t;
}

/** Sends from the mailbox that does `msg.from`'s job. Throws on failure; false when that mailbox isn't set up. */
async function sendViaMailbox(msg: EmailMessage): Promise<boolean> {
  const role = msg.from ?? "orders";
  const box = await mailboxFor(role);
  if (!box) return false;
  // Customers' replies to order emails go to the customer-questions mailbox, not to no-reply@.
  const replyTo = msg.replyTo ?? (role === "orders" || role === "admin" ? await addressFor("support") : undefined);
  await mailboxTransport(box).sendMail({
    from: { name: box.displayName, address: box.address },
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo: replyTo && replyTo !== box.address ? replyTo : undefined,
    headers: msg.headers,
    inReplyTo: msg.inReplyTo,
    references: msg.references,
  });
  return true;
}

function logToConsole(msg: EmailMessage): void {
  // eslint-disable-next-line no-console
  console.log(
    [
      "\n──────── 📧  EMAIL (console provider) ────────",
      `From:    ${msg.from ?? "orders"} mailbox (not set up, so only logged here)`,
      `To:      ${msg.to}`,
      `Subject: ${msg.subject}`,
      msg.replyTo ? `Reply-To: ${msg.replyTo}` : "",
      "─────────────────────────────────────────────",
      msg.text || msg.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      "─────────────────────────────────────────────\n",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

/**
 * Sends an email from the shop: from its mailbox when set up, otherwise through EMAIL_PROVIDER.
 * Never throws: a failed email must not break a checkout or registration (it is logged).
 */
export async function sendEmail(msg: EmailMessage): Promise<void> {
  try {
    await sendEmailOrThrow(msg);
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}

/** Like sendEmail, but a failure throws, for screens that must say whether it went (campaigns, replies). */
export async function sendEmailOrThrow(msg: EmailMessage): Promise<void> {
  if (await sendViaMailbox(msg)) return;
  const provider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();
  switch (provider) {
    case "resend":
      return await sendViaResend(msg);
    case "smtp":
      return await sendViaSmtp(msg);
    default:
      return logToConsole(msg);
  }
}

/** The team's mailbox for a job, e.g. teamAddress("admin") for a new-order alert. */
export const teamAddress = (role: MailRole) => addressFor(role);
