import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { ensureMailTables } from "@/lib/mail/db";
import { addressFor, mailboxFor } from "@/lib/mail/accounts";
import { audienceCounts, AUDIENCES, campaignEmail, type Audience } from "@/lib/mail/marketing";
import { CampaignEditor, CampaignSender } from "@/components/admin/marketing/CampaignEditor";

export const dynamic = "force-dynamic";

/** Admin → Marketing → a campaign: write it, preview it, send a test, then send it to the list. */
export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  await ensureMailTables();
  const isNew = id === "new";
  const c = isNew ? null : await prisma.marketingCampaign.findUnique({ where: { id } });
  if (!isNew && !c) notFound();

  const [counts, sender, ready] = await Promise.all([audienceCounts(), addressFor("marketing"), mailboxFor("marketing")]);
  const failures = c && c.failCount > 0
    ? await prisma.marketingSend.findMany({ where: { campaignId: c.id, status: "FAILED" }, select: { email: true, error: true }, take: 50 })
    : [];
  const preview = c ? campaignEmail(c, "preview@example.com").html : null;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between text-sm">
        <Link href="/admin/marketing" className="text-ink-muted hover:text-ink">← Marketing</Link>
      </div>
      <h1 className="text-2xl font-medium">{isNew ? "New campaign" : c!.subject}</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <CampaignEditor
          initial={
            c
              ? {
                  id: c.id,
                  subject: c.subject,
                  preheader: c.preheader ?? "",
                  heading: c.heading,
                  body: c.body,
                  imageUrl: c.imageUrl ?? "",
                  buttonText: c.buttonText ?? "",
                  buttonUrl: c.buttonUrl ?? "",
                  audience: c.audience as Audience,
                }
              : null
          }
          locked={!!c && c.status !== "DRAFT"}
          audiences={AUDIENCES.map((a) => ({ ...a, count: counts[a.value] }))}
        />
        <div className="space-y-4">
          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-4 py-2 text-sm font-medium">Preview</h2>
            {preview ? (
              <iframe title="Preview" srcDoc={preview} sandbox="" className="h-[620px] w-full bg-white" />
            ) : (
              <p className="p-6 text-sm text-ink-muted">Save the campaign to see how it looks.</p>
            )}
          </section>
          {c && (
            <CampaignSender
              id={c.id}
              status={c.status}
              sender={sender}
              ready={!!ready}
              recipients={counts[c.audience as Audience] ?? 0}
              sent={c.sentCount}
              failed={c.failCount}
              testTo={me.email ?? ""}
              failures={failures}
            />
          )}
        </div>
      </div>
    </div>
  );
}
