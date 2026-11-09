import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { ensureMailTables } from "@/lib/mail/db";
import { getMailboxes, getRoles, MAIL_SERVER, ROLES } from "@/lib/mail/accounts";
import { syncAll } from "@/lib/mail/inbox";
import { RefreshInbox } from "@/components/admin/inbox/InboxControls";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PER_PAGE = 50;
const short = (address: string) => address.split("@")[0] + "@";

/** Who it's from: for the shop's own notifications (contact form, new order) that's the customer in Reply-To. */
const sender = (m: { fromName: string | null; fromAddress: string; replyTo: string | null }) =>
  m.replyTo && m.replyTo !== m.fromAddress && m.fromAddress.endsWith("@urbanlane.uk") ? m.replyTo : m.fromName || m.fromAddress;

function when(d: Date) {
  const tz = "Asia/Karachi";
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: tz });
  if (day(d) === day(new Date())) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: tz });
}

/**
 * Admin → Inbox: every email that arrives in the shop's mailboxes (no-reply@, info@, manager@, admin@,
 * marketing@), newest first, with a tab per mailbox. Unread emails are bold and counted in the menu.
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ box?: string; unread?: string; q?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  await ensureMailTables();
  // fetch what arrived since the last check, but never keep the page waiting more than a few seconds
  await Promise.race([syncAll(60_000).catch(() => 0), new Promise((r) => setTimeout(r, 6000))]);

  const [boxes, roles] = await Promise.all([getMailboxes(), getRoles()]);
  const ready = boxes.filter((b) => b.password);
  const box = boxes.some((b) => b.address === sp.box) ? sp.box! : null;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.MailMessageWhereInput = {
    ...(box ? { mailbox: box } : {}),
    ...(sp.unread ? { isRead: false } : {}),
    ...(q ? { OR: [{ subject: { contains: q } }, { fromAddress: { contains: q } }, { fromName: { contains: q } }, { snippet: { contains: q } }] } : {}),
  };
  const [messages, total, unreadByBox] = await Promise.all([
    prisma.mailMessage.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: { id: true, mailbox: true, fromName: true, fromAddress: true, replyTo: true, subject: true, snippet: true, date: true, isRead: true, repliedAt: true, attachments: true },
    }),
    prisma.mailMessage.count({ where }),
    prisma.mailMessage.groupBy({ by: ["mailbox"], where: { isRead: false }, _count: { _all: true } }),
  ]);
  const unread = (address?: string) =>
    unreadByBox.filter((u) => !address || u.mailbox === address).reduce((n, u) => n + u._count._all, 0);
  const jobsOf = (address: string) => ROLES.filter((r) => roles[r.role] === address).map((r) => r.label);

  const link = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const next = { box, unread: sp.unread ?? null, q: q || null, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/admin/inbox?${s}` : "/admin/inbox";
  };
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">Inbox</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Every email to the shop&apos;s mailboxes. {unread() > 0 ? `${unread()} unread.` : "All read."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href={MAIL_SERVER.webmail} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">
            Webmail ↗
          </a>
          <RefreshInbox />
        </div>
      </div>

      {ready.length === 0 && (
        <p className="card p-4 text-sm">
          No mailbox is connected yet. Add the mailbox passwords in{" "}
          <Link href="/admin/settings" className="font-medium underline">
            Settings → Email
          </Link>{" "}
          and their emails will appear here.
        </p>
      )}

      <nav className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line" aria-label="Mailboxes">
        {[null, ...boxes.map((b) => b.address)].map((address) => {
          const n = unread(address ?? undefined);
          return (
            <Link
              key={address ?? "all"}
              href={link({ box: address, page: null })}
              title={address ? jobsOf(address).join(", ") || "Not used for a job" : undefined}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
                box === address ? "border-ink font-medium" : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              {address ? short(address) : "All"}
              {n > 0 && <span className="rounded-full bg-sale px-1.5 text-[11px] font-semibold leading-5 text-white">{n}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <form action="/admin/inbox" className="flex flex-1 gap-2">
          {box && <input type="hidden" name="box" value={box} />}
          {sp.unread && <input type="hidden" name="unread" value="1" />}
          <input name="q" defaultValue={q} placeholder="Search sender, subject or text" className="input max-w-sm" aria-label="Search email" />
          <button className="btn-ghost px-4">Search</button>
        </form>
        <Link href={link({ unread: sp.unread ? null : "1", page: null })} className="text-sm underline underline-offset-4">
          {sp.unread ? "Show all" : "Unread only"}
        </Link>
      </div>

      <div className="card divide-y divide-line-soft">
        {messages.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-muted">{q || sp.unread ? "Nothing matches." : "No email yet."}</p>
        ) : (
          messages.map((m) => (
            <Link
              key={m.id}
              href={`/admin/inbox/${m.id}`}
              className={cn("grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 px-4 py-3 hover:bg-line-soft/60", !m.isRead && "bg-white")}
            >
              <span className={cn("flex min-w-0 items-center gap-2 text-sm", !m.isRead && "font-semibold")}>
                {!m.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-sale" aria-label="Unread" />}
                <span className="truncate">{sender(m)}</span>
                {!box && <span className="shrink-0 rounded bg-line-soft px-1.5 text-[11px] font-normal text-ink-muted">{short(m.mailbox)}</span>}
                {m.repliedAt && <span className="shrink-0 text-[11px] font-normal text-success">Replied</span>}
              </span>
              <span className="text-right text-xs text-ink-muted">
                {m.attachments && <span aria-label="Has attachments">📎 </span>}
                {when(m.date)}
              </span>
              <span className="col-span-2 truncate text-sm">
                <span className={cn(!m.isRead && "font-semibold")}>{m.subject}</span>
                <span className="text-ink-muted"> · {m.snippet}</span>
              </span>
            </Link>
          ))
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={link({ page: String(page - 1) })} className="underline">← Newer</Link> : <span />}
          <span className="text-ink-muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={link({ page: String(page + 1) })} className="underline">Older →</Link> : <span />}
        </div>
      )}
    </div>
  );
}
