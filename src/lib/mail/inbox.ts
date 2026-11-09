import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import MailComposer from "nodemailer/lib/mail-composer";
import { prisma } from "@/lib/prisma";
import { mailboxTransport } from "@/lib/email";
import { ensureMailTables } from "./db";
import { getMailboxes, MAIL_SERVER, type Mailbox } from "./accounts";

/**
 * Admin → Inbox: every email received in the shop's mailboxes, in one place. New mail is read from each
 * mailbox's INBOX over IMAP (Hostinger) and copied into MailMessage, so the list opens instantly and the
 * unread count can show in the admin menu. The first check of a mailbox takes its newest 200 emails; after
 * that, only what arrived since. Opening an email marks it read in the mailbox too, so Webmail agrees.
 */

const FIRST_SYNC = 200;
const MAX_BODY = 500_000; // characters of text/HTML kept per email
const MAX_SOURCE = 15 * 1024 * 1024; // bigger emails keep their headers only ("open in Webmail")

function client(box: Mailbox) {
  return new ImapFlow({
    host: MAIL_SERVER.imapHost,
    port: MAIL_SERVER.imapPort,
    secure: MAIL_SERVER.imapSecure,
    auth: { user: box.address, pass: box.password! },
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
}

const addresses = (a: AddressObject | AddressObject[] | undefined) =>
  (Array.isArray(a) ? a : a ? [a] : []).map((x) => x.text).join(", ");

const snippetOf = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 280);

/** Reads new mail from one mailbox into MailMessage. Returns how many emails were added. */
export async function syncMailbox(box: Mailbox): Promise<number> {
  if (!box.password) return 0;
  await ensureMailTables();
  const account = await prisma.mailAccount.findUnique({ where: { address: box.address } });
  const imap = client(box);
  let added = 0;
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock("INBOX");
    try {
      const mailbox = imap.mailbox;
      if (!mailbox) return 0;
      const validity = BigInt(mailbox.uidValidity ?? 0);
      const sameFolder = account && account.uidValidity === validity && account.lastUid > 0;
      const lastUid = sameFolder ? account.lastUid : 0;
      if (!sameFolder) await prisma.mailMessage.deleteMany({ where: { mailbox: box.address } });

      let uids: number[] = [];
      if (mailbox.exists > 0) {
        const found = (await imap.search(lastUid ? { uid: `${lastUid + 1}:*` } : { all: true }, { uid: true })) || [];
        uids = found.filter((u) => u > lastUid).sort((a, b) => a - b);
        if (!lastUid) uids = uids.slice(-FIRST_SYNC);
      }

      let newest = lastUid;
      if (uids.length) {
        for await (const msg of imap.fetch(uids.join(","), { uid: true, flags: true, size: true, envelope: true, source: true }, { uid: true })) {
          newest = Math.max(newest, msg.uid);
          const seen = msg.flags?.has("\\Seen") ?? false;
          const env = msg.envelope;
          const big = (msg.size ?? 0) > MAX_SOURCE || !msg.source;
          const parsed = big ? null : await simpleParser(msg.source!);
          const from = parsed?.from?.value[0] ?? { name: env?.from?.[0]?.name, address: env?.from?.[0]?.address };
          const text = parsed?.text ?? "";
          // scripts never run here (emails show in a sandbox), and they needn't be kept either
          const html = parsed?.html ? parsed.html.replace(/<script\b[\s\S]*?<\/script>/gi, "") : null;
          const data = {
            mailbox: box.address,
            uid: msg.uid,
            messageId: (parsed?.messageId ?? env?.messageId ?? null)?.slice(0, 500) ?? null,
            fromName: from.name?.slice(0, 200) || null,
            fromAddress: (from.address || "unknown").slice(0, 320),
            replyTo: (parsed?.replyTo?.value[0]?.address ?? env?.replyTo?.[0]?.address)?.slice(0, 320) || null,
            toList: (parsed ? addresses(parsed.to) : (env?.to ?? []).map((t) => t.address).join(", ")).slice(0, 1000),
            subject: (parsed?.subject ?? env?.subject ?? "(no subject)").slice(0, 500) || "(no subject)",
            date: parsed?.date ?? env?.date ?? new Date(),
            snippet: big ? "This email is too large to show here. Open it in Webmail." : snippetOf(text || (html ? html.replace(/<[^>]+>/g, " ") : "")),
            text: text ? text.slice(0, MAX_BODY) : null,
            html: html ? html.slice(0, MAX_BODY) : null,
            attachments: parsed?.attachments.length
              ? JSON.stringify(parsed.attachments.map((a) => ({ name: a.filename ?? "attachment", size: a.size, type: a.contentType })))
              : null,
            isRead: seen,
          };
          await prisma.mailMessage.upsert({ where: { mailbox_uid: { mailbox: box.address, uid: msg.uid } }, update: {}, create: data });
          added++;
        }
      }
      await prisma.mailAccount.upsert({
        where: { address: box.address },
        update: { lastUid: newest, uidValidity: validity, lastSyncAt: new Date(), lastError: null },
        create: { address: box.address, lastUid: newest, uidValidity: validity, lastSyncAt: new Date() },
      });
    } finally {
      lock.release();
    }
    await imap.logout();
  } catch (err) {
    imap.close();
    const message = err instanceof Error ? err.message : String(err);
    await prisma.mailAccount
      .upsert({
        where: { address: box.address },
        update: { lastError: message.slice(0, 500), lastSyncAt: new Date() },
        create: { address: box.address, lastError: message.slice(0, 500), lastSyncAt: new Date() },
      })
      .catch(() => {});
    throw err;
  }
  return added;
}

let running: Promise<number> | null = null;

/**
 * Checks every mailbox that has a password, at most once per `minAgeMs` each (the admin menu asks every
 * minute; the Inbox's Refresh button passes 0). One check at a time; a mailbox that fails is skipped and
 * its error shown in Settings.
 */
export function syncAll(minAgeMs = 60_000): Promise<number> {
  running ??= (async () => {
    await ensureMailTables();
    const [boxes, accounts] = await Promise.all([getMailboxes(), prisma.mailAccount.findMany()]);
    let total = 0;
    for (const box of boxes) {
      if (!box.password) continue;
      const last = accounts.find((a) => a.address === box.address)?.lastSyncAt?.getTime() ?? 0;
      if (Date.now() - last < minAgeMs) continue;
      total += await syncMailbox(box).catch((err) => {
        console.error(`[mail] Couldn't check ${box.address}.`, err instanceof Error ? err.message : err);
        return 0;
      });
    }
    return total;
  })().finally(() => {
    running = null;
  });
  return running;
}

export async function unreadCount(): Promise<number> {
  try {
    await ensureMailTables();
    return await prisma.mailMessage.count({ where: { isRead: false } });
  } catch {
    return 0;
  }
}

/** Marks an email read (or unread) in its mailbox as well. Best-effort on the mailbox side. */
export async function setSeen(id: string, seen: boolean): Promise<void> {
  const msg = await prisma.mailMessage.update({ where: { id }, data: { isRead: seen }, select: { mailbox: true, uid: true } });
  const box = (await getMailboxes()).find((b) => b.address === msg.mailbox);
  if (!box?.password) return;
  const imap = client(box);
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock("INBOX");
    try {
      if (seen) await imap.messageFlagsAdd(String(msg.uid), ["\\Seen"], { uid: true });
      else await imap.messageFlagsRemove(String(msg.uid), ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
    await imap.logout();
  } catch (err) {
    imap.close();
    console.error("[mail] Couldn't update the read mark in the mailbox.", err instanceof Error ? err.message : err);
  }
}

/** Puts a copy of a sent email in the mailbox's Sent folder, so it shows in Webmail. Best-effort. */
async function saveToSent(box: Mailbox, raw: Buffer): Promise<void> {
  const imap = client(box);
  try {
    await imap.connect();
    const folders = await imap.list();
    let sent =
      folders.find((f) => f.specialUse === "\\Sent")?.path ??
      folders.find((f) => /^(inbox\.)?sent( items| messages)?$/i.test(f.path))?.path;
    if (!sent) {
      // Hostinger mailboxes have one; create it on a mail server that doesn't
      const delimiter = folders.find((f) => f.path.toUpperCase() === "INBOX")?.delimiter ?? ".";
      sent = `INBOX${delimiter}Sent`;
      await imap.mailboxCreate(sent).catch(() => {});
    }
    await imap.append(sent, raw, ["\\Seen"]);
    await imap.logout();
  } catch (err) {
    imap.close();
    console.error("[mail] Couldn't save the reply in Sent.", err instanceof Error ? err.message : err);
  }
}

/** Replies to an email from the mailbox it arrived in, threaded with it, and keeps a copy in Sent. */
export async function replyTo(id: string, body: string): Promise<{ to: string }> {
  const msg = await prisma.mailMessage.findUniqueOrThrow({ where: { id } });
  const box = (await getMailboxes()).find((b) => b.address === msg.mailbox);
  if (!box?.password) throw new Error(`${msg.mailbox} isn't set up yet: add its password in Settings → Email.`);
  const subject = /^re:/i.test(msg.subject) ? msg.subject : `Re: ${msg.subject}`;
  const quoted = (msg.text ?? msg.snippet)
    .split("\n")
    .slice(0, 60)
    .map((l) => `> ${l}`)
    .join("\n");
  const when = msg.date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });
  // the sender's Reply-To when there is one: a contact-form message is sent by the shop for the customer
  const to = msg.replyTo || msg.fromAddress;
  const text = `${body.trim()}\n\nOn ${when}, ${msg.fromName ? `${msg.fromName} <${msg.fromAddress}>` : msg.fromAddress} wrote:\n${quoted}\n`;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">${esc(body.trim())}</div>`;
  const mail = {
    from: { name: box.displayName, address: box.address },
    to,
    subject,
    text,
    html,
    ...(msg.messageId ? { inReplyTo: msg.messageId, references: msg.messageId } : {}),
  };
  const raw = await new MailComposer(mail).compile().build();
  await mailboxTransport(box).sendMail({ envelope: { from: box.address, to: [to] }, raw });
  await prisma.mailMessage.update({ where: { id }, data: { repliedAt: new Date(), isRead: true } });
  await saveToSent(box, raw);
  return { to };
}

/** Checks a mailbox's password against the mail server (sending and reading). */
export async function testMailbox(box: Mailbox): Promise<{ ok: boolean; message: string }> {
  try {
    await mailboxTransport(box).verify();
  } catch (err) {
    return { ok: false, message: `Sending: ${err instanceof Error ? err.message : String(err)}` };
  }
  const imap = client(box);
  try {
    await imap.connect();
    await imap.logout();
  } catch (err) {
    imap.close();
    return { ok: false, message: `Reading: ${err instanceof Error ? err.message : String(err)}` };
  }
  return { ok: true, message: "Connected: this mailbox can send and receive." };
}
