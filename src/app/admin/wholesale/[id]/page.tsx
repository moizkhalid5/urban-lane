import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { syncAll } from "@/lib/mail/inbox";
import { ensureWholesaleTables } from "@/lib/wholesale/db";
import {
  catchUpEmailReplies,
  endOfToday,
  getWholesaleSettings,
  nextToContact,
  STAGES,
  stageOf,
  telLink,
  threadFor,
  whatsappLink,
  type ThreadItem,
} from "@/lib/wholesale/prospects";
import { offerLines, templatesFor } from "@/lib/wholesale/templates";
import { Composer } from "@/components/admin/wholesale/Composer";
import { PriorityChip } from "@/components/admin/wholesale/Chips";
import { deleteProspectAction, followUpAction, setStageAction, updateProspectAction } from "../actions";
import { PITCH_GUIDE } from "../guide/content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Wholesale — Urban Lane admin" };

const when = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi" });
const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Karachi" });
const ymd = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

const KIND_LABEL: Record<string, string> = { WHATSAPP: "WhatsApp", EMAIL: "Email", CALL: "Call", NOTE: "Note", STAGE: "Stage" };

/**
 * Admin → Wholesale → one store: who they are and what to offer them (left), and the whole conversation
 * with a message box (right). Emails they send to our mailboxes show up here by themselves.
 */
export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  await ensureWholesaleTables();
  // fetch new mail first (at most once a minute), so their email replies are in the thread
  await Promise.race([syncAll(60_000).catch(() => 0), new Promise((r) => setTimeout(r, 6000))]);
  await catchUpEmailReplies().catch(() => undefined);
  const p = await prisma.wholesaleProspect.findUnique({ where: { id } });
  if (!p) notFound();
  const [settings, thread, next] = await Promise.all([getWholesaleSettings(), threadFor(p), nextToContact(p.id)]);
  const templates = templatesFor(p, settings);
  const { theySell, alsoSuits } = offerLines(p.stockToOffer);
  const brands = (p.ourBrands ?? "").split(",").map((b) => b.trim()).filter(Boolean);
  const wa = whatsappLink(p.whatsapp);
  const waBase = wa ? wa.split("?")[0] : null;
  const due = p.followUpAt && p.followUpAt <= endOfToday() && !["WON", "LOST"].includes(p.stage);
  const placeholdersLeft = !settings.yourName.trim() || !settings.yourWhatsApp.trim();

  const links = [
    wa && { label: "WhatsApp", href: wa },
    telLink(p.phone) && { label: `Call ${p.phone}`, href: telLink(p.phone)! },
    p.email && { label: "Email", href: `mailto:${p.email.split(/[;,\s]+/)[0]}` },
    p.website && { label: "Website", href: p.website },
    p.instagram && { label: "Instagram", href: p.instagram },
    p.facebook && { label: "Facebook", href: p.facebook },
    p.tiktok && { label: "TikTok", href: p.tiktok },
  ].filter((l): l is { label: string; href: string } => !!l);

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/wholesale" className="text-sm text-ink-muted hover:text-ink">
            ← Wholesale
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-semibold">
            {p.name}
            <PriorityChip priority={p.priority} />
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {[p.stockType, p.shopType, p.city].filter(Boolean).join(" · ")}
            {p.lastContactAt && ` · last contact ${when(p.lastContactAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={setStageAction} className="flex items-center gap-2">
            <input type="hidden" name="prospectId" value={p.id} />
            <select name="stage" defaultValue={p.stage} className="input text-sm">
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <button className="btn-secondary">Set stage</button>
          </form>
          {next && (
            <Link href={`/admin/wholesale/${next.id}`} className="btn-primary">
              Next to contact →
            </Link>
          )}
        </div>
      </div>

      {p.caution && (
        <div className="rounded-lg border border-sale/40 bg-sale/5 px-4 py-3 text-sm">
          <span className="font-semibold text-sale">Check first: </span>
          {p.caution}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* ---------- about the store ---------- */}
        <div className="space-y-5">
          <Card title="Get in touch">
            <div className="flex flex-wrap gap-2">
              {links.length ? (
                links.map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-ink">
                    {l.label} ↗
                  </a>
                ))
              ) : (
                <p className="text-sm text-ink-muted">No contact details published. Add them below.</p>
              )}
            </div>
            {p.address && <p className="mt-3 text-sm text-ink-soft">{p.address}</p>}
            {p.otherContacts && <p className="mt-2 break-words text-xs text-ink-muted">{p.otherContacts}</p>}
          </Card>

          <Card title="Follow-up">
            <p className={cn("text-sm", due ? "font-semibold text-sale" : "text-ink-soft")}>
              {p.followUpAt ? `${due ? "Due" : "Next"}: ${day(p.followUpAt)}` : "No follow-up set."}
              {p.nextStep && <span className="font-normal text-ink-soft"> · {p.nextStep}</span>}
            </p>
            <form action={followUpAction} className="mt-3 space-y-2">
              <input type="hidden" name="prospectId" value={p.id} />
              <div className="flex flex-wrap gap-2">
                {[
                  [1, "Tomorrow"],
                  [2, "In 2 days"],
                  [7, "In a week"],
                ].map(([n, label]) => (
                  <button key={n} name="inDays" value={n} className="rounded-full border border-line px-3 py-1 text-sm hover:border-ink">
                    {label}
                  </button>
                ))}
                <button name="clear" value="1" className="rounded-full px-3 py-1 text-sm text-ink-muted underline underline-offset-4">
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <input type="date" name="date" defaultValue={p.followUpAt ? ymd(p.followUpAt) : ""} className="input text-sm" />
                <input name="nextStep" defaultValue={p.nextStep ?? ""} placeholder="Next step, e.g. call about kidswear" className="input min-w-0 flex-1 text-sm" />
                <button className="btn-secondary">Save</button>
              </div>
            </form>
          </Card>

          <Card title={`What to offer them${p.unitsInBrands ? ` · ${p.unitsInBrands.toLocaleString("en-GB")} pieces in their brands` : ""}`}>
            {theySell.length > 0 && (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Brands they already sell (strongest pitch)</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {theySell.map((l) => (
                    <li key={l} className="flex gap-2">
                      <span className="text-success">✓</span>
                      {l}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {alsoSuits.length > 0 && (
              <>
                <p className="mt-4 text-xs font-medium uppercase tracking-wide text-ink-muted">Also suits their store</p>
                <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                  {alsoSuits.map((l) => (
                    <li key={l} className="flex gap-2">
                      <span>+</span>
                      {l}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!theySell.length && !alsoSuits.length && <p className="text-sm text-ink-muted">Nothing noted yet.</p>}
            {p.pitchAngle && (
              <p className="mt-4 text-sm">
                <span className="text-ink-muted">Angle: </span>
                {p.pitchAngle}
              </p>
            )}
          </Card>

          <Card title={`About them${brands.length ? ` · ${brands.length} of our brands` : ""}`}>
            {brands.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {brands.map((b) => (
                  <span key={b} className="rounded-full bg-[#e3f6e3] px-2.5 py-0.5 text-xs text-[#006300]">
                    {b}
                  </span>
                ))}
              </div>
            )}
            {p.whatTheySell && <p className="mt-3 text-sm text-ink-soft">{p.whatTheySell}</p>}
            {p.theirBrands && (
              <p className="mt-2 text-sm text-ink-muted">
                <span className="text-ink-soft">Their other brands:</span> {p.theirBrands}
              </p>
            )}
            {p.segments && <p className="mt-2 text-xs text-ink-muted">{p.segments}</p>}
            {(p.notes || p.evidence) && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-ink-soft underline underline-offset-4">Research notes and evidence</summary>
                {p.notes && <p className="mt-2 whitespace-pre-line text-ink-soft">{p.notes}</p>}
                {p.evidence && (
                  <ul className="mt-2 space-y-1 break-all text-xs">
                    {p.evidence.split(/\s+/).filter((u) => /^https?:/.test(u)).map((u) => (
                      <li key={u}>
                        <a href={u} target="_blank" rel="noreferrer" className="underline">
                          {u}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            )}
          </Card>

          <details className="rounded-xl border border-line bg-white p-5">
            <summary className="cursor-pointer text-[15px] font-semibold">Contact details and pitch (edit)</summary>
            <form action={updateProspectAction} className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <input type="hidden" name="prospectId" value={p.id} />
              {(
                [
                  ["name", "Store name", p.name],
                  ["website", "Website", p.website],
                  ["city", "City", p.city],
                  ["phone", "Phone", p.phone],
                  ["whatsapp", "WhatsApp", p.whatsapp],
                  ["email", "Email", p.email],
                  ["instagram", "Instagram", p.instagram],
                  ["facebook", "Facebook", p.facebook],
                ] as const
              ).map(([k, label, v]) => (
                <label key={k} className="block text-xs text-ink-muted">
                  {label}
                  <input name={k} defaultValue={v ?? ""} className="input mt-1 w-full text-sm" />
                </label>
              ))}
              <label className="block text-xs text-ink-muted">
                Priority
                <select name="priority" defaultValue={p.priority} className="input mt-1 w-full text-sm">
                  {["High", "Medium", "Low", "Check first"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-ink-muted sm:col-span-2">
                Their pitch (the "First pitch" template)
                <textarea name="pitch" defaultValue={p.pitch ?? ""} rows={8} className="input mt-1 w-full text-sm" />
              </label>
              <div className="flex items-center justify-between sm:col-span-2">
                <button className="btn-primary">Save details</button>
              </div>
            </form>
            <form action={deleteProspectAction} className="mt-4 border-t border-line pt-3">
              <input type="hidden" name="prospectId" value={p.id} />
              <button className="text-xs text-sale underline underline-offset-4">Remove this store and its conversation</button>
            </form>
          </details>
        </div>

        {/* ---------- conversation ---------- */}
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold">Conversation</h2>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", stageOf(p.stage).tone)}>{stageOf(p.stage).label}</span>
            </div>
            <Thread items={thread} />
          </div>
          <Composer
            prospectId={p.id}
            waBase={waBase}
            email={p.email}
            phone={p.phone}
            templates={templates.map(({ key, label, subject, body }) => ({ key, label, subject, body }))}
            placeholdersLeft={placeholdersLeft}
          />
          <details className="rounded-xl border border-line bg-white p-5 text-sm">
            <summary className="cursor-pointer text-[15px] font-semibold">Pitch guide: talking points and answers</summary>
            <div className="mt-3 space-y-4">
              {PITCH_GUIDE.map((s) => (
                <div key={s.heading}>
                  <p className="font-medium">{s.heading}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-soft">
                    {s.points.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Chat-style thread: ours on the right, theirs on the left, notes and stage changes in the middle. */
function Thread({ items }: { items: ThreadItem[] }) {
  if (!items.length) return <p className="py-8 text-center text-sm text-ink-muted">No messages yet. Start with the pitch below.</p>;
  return (
    <ol className="space-y-3">
      {items.map((m) => {
        if (m.kind === "STAGE" || m.direction === "NONE") {
          return (
            <li key={m.id} className="text-center">
              <span className={cn("inline-block max-w-[90%] rounded-lg px-3 py-1.5 text-xs", m.kind === "STAGE" ? "text-ink-muted" : "bg-[#fff8e1] text-left text-ink-soft")}>
                {m.kind === "NOTE" && <span className="font-medium">Note: </span>}
                <span className="whitespace-pre-line">{m.body}</span>
                <span className="ml-2 text-[11px] text-ink-muted">{when(m.at)}</span>
              </span>
            </li>
          );
        }
        const out = m.direction === "OUT";
        return (
          <li key={m.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", out ? "rounded-br-sm bg-[#dcf3e3]" : "rounded-bl-sm border border-line bg-white")}>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                {out ? "You" : (m.author ?? "Them")} · {KIND_LABEL[m.kind] ?? m.kind}
                {m.inboxId && (
                  <Link href={`/admin/inbox/${m.inboxId}`} className="ml-2 normal-case tracking-normal underline">
                    open in Inbox
                  </Link>
                )}
              </p>
              {m.subject && <p className="mb-1 font-medium">{m.subject}</p>}
              <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
              <p className="mt-1 text-right text-[11px] text-ink-muted">{when(m.at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
