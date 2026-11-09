import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { ensureMailTables } from "./db";

/**
 * The shop's mailboxes (Hostinger, urbanlane.uk) and which one does which job:
 *
 *   orders    no-reply@  order confirmations, shipping and status updates, account emails
 *   support   info@      customer questions: the contact form arrives here, and customers' replies to
 *                        order emails come here (Reply-To)
 *   marketing manager@   campaigns from Admin → Marketing, the newsletter welcome
 *   admin     admin@     the admin portal: new-order alerts for the team
 *   finance   manager@   payments, refunds and anything with money in it
 *
 * The jobs can be moved to other mailboxes in Admin → Settings → Email. Each mailbox's password is entered
 * there too, stored encrypted (AES-256-GCM, key made from AUTH_SECRET), so a copy of the database alone
 * doesn't open the mailboxes. A mailbox without a password can't send or be read; email then falls back to
 * the server's EMAIL_PROVIDER setting (lib/email), as before.
 */
export const MAILBOXES = [
  "no-reply@urbanlane.uk",
  "info@urbanlane.uk",
  "manager@urbanlane.uk",
  "admin@urbanlane.uk",
  "marketing@urbanlane.uk",
] as const;

export type MailRole = "orders" | "support" | "marketing" | "admin" | "finance";

export const ROLES: { role: MailRole; label: string; help: string }[] = [
  { role: "orders", label: "Orders & shipping", help: "Order confirmations, shipping and status updates, account emails." },
  { role: "support", label: "Customer questions", help: "Contact-form messages arrive here, and customers' replies to order emails." },
  { role: "marketing", label: "Marketing", help: "Campaigns from Admin → Marketing and the newsletter welcome." },
  { role: "admin", label: "Admin portal", help: "Alerts for the team, such as a new order." },
  { role: "finance", label: "Payments & finance", help: "Payment receipts and refund requests." },
];

export const DEFAULT_ROLES: Record<MailRole, string> = {
  orders: "no-reply@urbanlane.uk",
  support: "info@urbanlane.uk",
  marketing: "manager@urbanlane.uk",
  admin: "admin@urbanlane.uk",
  finance: "manager@urbanlane.uk",
};

/** Hostinger's mail servers; overridable for a local test mail server. */
export const MAIL_SERVER = {
  smtpHost: process.env.MAIL_SMTP_HOST || "smtp.hostinger.com",
  smtpPort: Number(process.env.MAIL_SMTP_PORT || 465),
  smtpSecure: (process.env.MAIL_SMTP_SECURE ?? "true") !== "false",
  imapHost: process.env.MAIL_IMAP_HOST || "imap.hostinger.com",
  imapPort: Number(process.env.MAIL_IMAP_PORT || 993),
  imapSecure: (process.env.MAIL_IMAP_SECURE ?? "true") !== "false",
  webmail: "https://mail.hostinger.com",
};

// ── passwords ────────────────────────────────────────────────────────────────

const key = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`urban-lane-mailboxes:${secret}`).digest();
};

export function encryptPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** null when it can't be read (e.g. AUTH_SECRET changed: enter the password again). */
export function decryptPassword(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [v, iv, tag, data] = stored.split(":");
    if (v !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ── reading the settings ─────────────────────────────────────────────────────

export type Mailbox = { address: string; displayName: string; password: string | null };

/** Every mailbox with its (decrypted) password; per request. Empty when the tables can't be read. */
export const getMailboxes = cache(async (): Promise<Mailbox[]> => {
  try {
    await ensureMailTables();
    const rows = await prisma.mailAccount.findMany();
    return MAILBOXES.map((address) => {
      const row = rows.find((r) => r.address === address);
      return { address, displayName: row?.displayName ?? "Urban Lane", password: decryptPassword(row?.password) };
    });
  } catch (err) {
    console.error("[mail] Couldn't read the mailboxes.", err);
    return MAILBOXES.map((address) => ({ address, displayName: "Urban Lane", password: null }));
  }
});

export const getRoles = cache(async (): Promise<Record<MailRole, string>> => {
  try {
    await ensureMailTables();
    const row = await prisma.mailSettings.findUnique({ where: { id: "singleton" } });
    const saved = row ? (JSON.parse(row.roles) as Partial<Record<MailRole, string>>) : {};
    const roles = { ...DEFAULT_ROLES };
    for (const r of ROLES) {
      const a = saved[r.role];
      if (a && (MAILBOXES as readonly string[]).includes(a)) roles[r.role] = a;
    }
    return roles;
  } catch {
    return { ...DEFAULT_ROLES };
  }
});

/** The mailbox address that does a job (whether or not its password is set). */
export async function addressFor(role: MailRole): Promise<string> {
  return (await getRoles())[role];
}

/** The mailbox that does a job, when it can send (password set). */
export async function mailboxFor(role: MailRole): Promise<Mailbox | null> {
  const address = await addressFor(role);
  const box = (await getMailboxes()).find((m) => m.address === address);
  return box?.password ? box : null;
}

/** For Admin → Settings → Email: each mailbox's state, without its password. */
export async function mailboxesForSettings() {
  await ensureMailTables();
  const rows = await prisma.mailAccount.findMany();
  return MAILBOXES.map((address) => {
    const row = rows.find((r) => r.address === address);
    return {
      address,
      displayName: row?.displayName ?? "Urban Lane",
      hasPassword: !!decryptPassword(row?.password),
      lastError: row?.lastError ?? null,
      lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
    };
  });
}
