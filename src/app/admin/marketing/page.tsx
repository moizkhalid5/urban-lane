import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { ensureMailTables } from "@/lib/mail/db";
import { addressFor, mailboxFor } from "@/lib/mail/accounts";
import { audienceCounts, AUDIENCES } from "@/lib/mail/marketing";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Draft", tone: "bg-line-soft text-ink-soft" },
  SENDING: { label: "Sending (paused)", tone: "bg-amber-100 text-amber-900" },
  SENT: { label: "Sent", tone: "bg-green-100 text-green-900" },
};

/** Admin → Marketing: email campaigns to the people who agreed to hear from the shop. */
export default async function MarketingPage() {
  await requireAdmin();
  await ensureMailTables();
  const [campaigns, counts, sender, ready] = await Promise.all([
    prisma.marketingCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    audienceCounts(),
    addressFor("marketing"),
    mailboxFor("marketing"),
  ]);
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">Marketing</h1>
          <p className="mt-1 text-sm text-ink-muted">Email campaigns, sent from {sender}.</p>
        </div>
        <Link href="/admin/marketing/new" className="btn-primary">
          New campaign
        </Link>
      </div>

      {!ready && (
        <p className="card p-4 text-sm">
          {sender} isn&apos;t connected yet, so campaigns can be written but not sent. Add its password in{" "}
          <Link href="/admin/settings" className="font-medium underline">
            Settings → Email
          </Link>
          .
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {AUDIENCES.map((a) => (
          <div key={a.value} className="card p-4">
            <p className="text-2xl font-semibold tabular-nums">{counts[a.value].toLocaleString("en-GB")}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{a.label}</p>
          </div>
        ))}
      </section>
      <p className="-mt-3 text-xs text-ink-muted">
        Only people who agreed to marketing emails are counted: newsletter sign-ups, and customers who ticked the box when
        creating an account. Every email has an unsubscribe link, and anyone who uses it is taken off both lists.
      </p>

      <section className="card">
        <h2 className="border-b border-line px-5 py-3 font-medium">Campaigns</h2>
        {campaigns.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-muted">No campaigns yet. Start with &ldquo;New campaign&rdquo;.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="px-5 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Sent</th>
                <th className="hidden px-5 py-2 text-right font-medium sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3">
                    <Link href={`/admin/marketing/${c.id}`} className="font-medium hover:underline">
                      {c.subject}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("rounded px-2 py-0.5 text-xs", STATUS[c.status]?.tone)}>{STATUS[c.status]?.label ?? c.status}</span>
                  </td>
                  <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">
                    {c.status === "DRAFT" ? "—" : c.sentCount}
                    {c.failCount > 0 && <span className="text-sale"> ({c.failCount} failed)</span>}
                  </td>
                  <td className="hidden px-5 py-3 text-right text-ink-muted sm:table-cell">{fmt(c.sentAt ?? c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
