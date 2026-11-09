import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { ensureMailTables } from "@/lib/mail/db";
import { MAIL_SERVER } from "@/lib/mail/accounts";
import { setSeen } from "@/lib/mail/inbox";
import { MarkUnread, ReplyBox } from "@/components/admin/inbox/InboxControls";

export const dynamic = "force-dynamic";

const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * One email. HTML emails are shown in a sandboxed frame: no scripts run, and links open in a new tab.
 * Opening it marks it read here and in the mailbox.
 */
export default async function EmailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  await ensureMailTables();
  const m = await prisma.mailMessage.findUnique({ where: { id } });
  if (!m) notFound();
  if (!m.isRead) {
    await prisma.mailMessage.update({ where: { id }, data: { isRead: true } });
    void setSeen(id, true).catch(() => {}); // the mailbox's own read mark, in the background
  }
  const attachments = m.attachments ? (JSON.parse(m.attachments) as { name: string; size: number }[]) : [];
  const date = m.date.toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Karachi" });
  // links in the email open in a new tab, outside the admin
  const html = m.html ? `<base target="_blank"><meta name="referrer" content="no-referrer">${m.html}` : null;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href="/admin/inbox" className="text-ink-muted hover:text-ink">← Inbox</Link>
        <div className="flex items-center gap-4">
          <MarkUnread id={m.id} />
          <a href={MAIL_SERVER.webmail} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            Open Webmail ↗
          </a>
        </div>
      </div>

      <div className="card p-5">
        <h1 className="text-xl font-medium">{m.subject}</h1>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-muted">From</dt>
          <dd className="min-w-0 break-words">
            {m.fromName ? <>{m.fromName} <span className="text-ink-muted">&lt;{m.fromAddress}&gt;</span></> : m.fromAddress}
          </dd>
          {m.replyTo && m.replyTo !== m.fromAddress && (
            <>
              <dt className="text-ink-muted">Reply to</dt>
              <dd className="min-w-0 break-words">{m.replyTo}</dd>
            </>
          )}
          <dt className="text-ink-muted">To</dt>
          <dd className="min-w-0 break-words">{m.toList || m.mailbox}</dd>
          <dt className="text-ink-muted">Mailbox</dt>
          <dd>{m.mailbox}</dd>
          <dt className="text-ink-muted">Date</dt>
          <dd>{date}</dd>
        </dl>
        {attachments.length > 0 && (
          <p className="mt-3 text-sm text-ink-soft">
            📎 {attachments.map((a) => `${a.name} (${size(a.size)})`).join(", ")}
            <span className="text-ink-muted"> · open in Webmail to download</span>
          </p>
        )}
      </div>

      <div className="card overflow-hidden">
        {html ? (
          <iframe title="Email" srcDoc={html} sandbox="allow-popups allow-popups-to-escape-sandbox" className="h-[70vh] w-full bg-white" />
        ) : (
          <pre className="whitespace-pre-wrap break-words p-5 font-sans text-sm leading-relaxed">{m.text || m.snippet}</pre>
        )}
      </div>

      <ReplyBox id={m.id} to={m.replyTo || m.fromAddress} from={m.mailbox} repliedAt={m.repliedAt?.toISOString() ?? null} />
    </div>
  );
}
