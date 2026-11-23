import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { catchUpEmailReplies, endOfToday, listProspects, nextToContact, STAGES, wholesaleStats, whatsappLink } from "@/lib/wholesale/prospects";
import { PriorityChip, StageChip } from "@/components/admin/wholesale/Chips";
import { addProspectAction, importAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Wholesale — Urban Lane admin" };

type Search = { view?: string; q?: string; priority?: string; segment?: string; due?: string; msg?: string };
const SEGMENTS = ["UK high-street", "Kidswear", "Menswear / surplus", "Lingerie & nightwear"];
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Karachi" });

/**
 * Admin → Wholesale: stores and brands to sell our stock to in bulk, as a board (one column per stage) or a
 * list, with what's due today on top. Each store opens into its conversation (app/admin/wholesale/[id]).
 */
export default async function WholesalePage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  await catchUpEmailReplies().catch(() => undefined);
  const filter = { q: sp.q, priority: sp.priority, segment: sp.segment, due: sp.due === "1" };
  const [stats, prospects, next] = await Promise.all([wholesaleStats(), listProspects(filter), nextToContact()]);
  const view = sp.view === "list" ? "list" : "board";
  const today = endOfToday();
  const qs = (patch: Partial<Search>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, msg: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/wholesale${p.toString() ? `?${p}` : ""}`;
  };
  const filtered = Boolean(sp.q || sp.priority || sp.segment || sp.due);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Wholesale outreach</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Stores and brands to sell our stock to in bulk. Open a store to see what to offer them, send the pitch on WhatsApp or
            email, and keep the whole conversation in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/wholesale" target="_blank" rel="noopener" className="btn-secondary">
            Wholesale page ↗
          </a>
          <Link href="/admin/wholesale/guide" className="btn-secondary">
            Pitch guide &amp; settings
          </Link>
          {next && (
            <Link href={`/admin/wholesale/${next.id}`} className="btn-primary">
              Start outreach →
            </Link>
          )}
        </div>
      </div>

      {sp.msg && <p className="border border-line bg-white px-4 py-3 text-sm">{sp.msg}</p>}

      {stats.total === 0 ? (
        <form action={importAction} className="rounded-xl border border-dashed border-line bg-white p-6">
          <h2 className="text-lg font-medium">Start by importing your research</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Choose the prospects file made from &ldquo;Urban Lane - Wholesale prospects (Oct 2026)&rdquo; (Wholesale\prospects-oct-2026.json).
            Every store comes in with its contacts, the brands you share, what to offer and a ready pitch.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input type="file" name="file" accept=".json,application/json" required className="text-sm" />
            <button className="btn-primary">Import stores</button>
          </div>
        </form>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            <Link
              href={qs({ due: sp.due === "1" ? undefined : "1" })}
              className={cn("rounded-xl border p-4", stats.due ? "border-sale/40 bg-sale/5" : "border-line bg-white", sp.due === "1" && "ring-2 ring-ink")}
            >
              <p className={cn("text-2xl font-semibold", stats.due && "text-sale")}>{stats.due}</p>
              <p className="text-sm text-ink-muted">follow-ups due today</p>
            </Link>
            {STAGES.map((s) => (
              <div key={s.key} className="rounded-xl border border-line bg-white p-4">
                <p className="text-2xl font-semibold">{stats.stages[s.key]}</p>
                <p className="text-sm text-ink-muted">{s.label}</p>
              </div>
            ))}
          </section>

          <form className="flex flex-wrap items-center gap-2" action="/admin/wholesale">
            <input type="hidden" name="view" value={view} />
            <input name="q" defaultValue={sp.q} placeholder="Search store, city, brand…" className="input !w-60 !py-2" />
            <select name="priority" defaultValue={sp.priority ?? ""} className="input !w-auto !py-2">
              <option value="">Any priority</option>
              {["High", "Medium", "Low", "Check first"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select name="segment" defaultValue={sp.segment ?? ""} className="input !w-auto !py-2">
              <option value="">Any type</option>
              {SEGMENTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button className="btn-secondary">Filter</button>
            {filtered && (
              <Link href={qs({ q: undefined, priority: undefined, segment: undefined, due: undefined })} className="text-sm underline underline-offset-4">
                Clear
              </Link>
            )}
            <div className="ml-auto flex rounded-full border border-line bg-white p-0.5 text-sm">
              {(["board", "list"] as const).map((v) => (
                <Link key={v} href={qs({ view: v })} className={cn("rounded-full px-3.5 py-1.5 capitalize", view === v ? "bg-ink text-white" : "text-ink-soft")}>
                  {v}
                </Link>
              ))}
            </div>
          </form>

          {view === "board" ? (
            <div className="-mx-1 overflow-x-auto pb-2">
              <div className="grid min-w-[1100px] grid-cols-6 gap-3 px-1">
                {STAGES.map((s) => {
                  const all = prospects.filter((p) => p.stage === s.key);
                  // a long "To contact" column shows the top 8 (by priority); the list view has them all
                  const col = all.slice(0, 8);
                  return (
                    <div key={s.key} className="rounded-xl bg-[#ecebe7]/60 p-2">
                      <div className="mb-2 flex items-center justify-between px-1">
                        <StageChip stage={s.key} />
                        <span className="text-xs text-ink-muted">{all.length}</span>
                      </div>
                      <div className="space-y-2">
                        {col.map((p) => {
                          const due = p.followUpAt && p.followUpAt <= today && !["WON", "LOST"].includes(p.stage);
                          return (
                            <Link key={p.id} href={`/admin/wholesale/${p.id}`} className="block rounded-lg border border-line bg-white p-3 text-sm shadow-sm hover:border-ink">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-medium leading-snug">{p.name}</p>
                                <PriorityChip priority={p.priority} />
                              </div>
                              <p className="mt-1 text-xs text-ink-muted">
                                {p.brandsInCommon} brands · {p.unitsInBrands.toLocaleString("en-GB")} pcs{p.city ? ` · ${p.city}` : ""}
                              </p>
                              <p className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                                {whatsappLink(p.whatsapp) && <span className="rounded bg-[#dcf3e3] px-1.5 py-0.5 text-[#0e6b36]">WhatsApp</span>}
                                {p.email && <span className="rounded bg-[#e3eefb] px-1.5 py-0.5 text-[#1c5cab]">Email</span>}
                                {p.phone && <span className="rounded bg-line-soft px-1.5 py-0.5 text-ink-soft">Phone</span>}
                                {!whatsappLink(p.whatsapp) && !p.email && !p.phone && <span className="text-ink-muted">Social only</span>}
                              </p>
                              {p.followUpAt && !["WON", "LOST"].includes(p.stage) && (
                                <p className={cn("mt-2 text-xs", due ? "font-semibold text-sale" : "text-ink-muted")}>
                                  {due ? "Due" : "Follow up"} {day(p.followUpAt)}
                                  {p.nextStep ? ` · ${p.nextStep}` : ""}
                                </p>
                              )}
                            </Link>
                          );
                        })}
                        {!col.length && <p className="px-1 py-3 text-xs text-ink-muted">None</p>}
                        {all.length > col.length && (
                          <Link href={qs({ view: "list" })} className="block px-1 py-2 text-xs underline underline-offset-4">
                            + {all.length - col.length} more in the list view
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-[#2b2f3a] text-left text-[11px] uppercase tracking-wide text-white">
                  <tr>
                    <th className="py-2.5 pl-4 font-medium">Store</th>
                    <th className="py-2.5 font-medium">Priority</th>
                    <th className="py-2.5 font-medium">Stage</th>
                    <th className="py-2.5 text-right font-medium">Brands</th>
                    <th className="py-2.5 text-right font-medium">Our pcs</th>
                    <th className="py-2.5 pl-4 font-medium">Contact</th>
                    <th className="py-2.5 font-medium">City</th>
                    <th className="py-2.5 pr-4 font-medium">Follow-up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {prospects.map((p) => {
                    const due = p.followUpAt && p.followUpAt <= today && !["WON", "LOST"].includes(p.stage);
                    return (
                      <tr key={p.id} className="hover:bg-line-soft/60">
                        <td className="py-2.5 pl-4">
                          <Link href={`/admin/wholesale/${p.id}`} className="font-medium hover:underline">
                            {p.name}
                          </Link>
                          {p.pitchAngle && <span className="block text-xs text-ink-muted">{p.pitchAngle}</span>}
                        </td>
                        <td className="py-2.5">
                          <PriorityChip priority={p.priority} />
                        </td>
                        <td className="py-2.5">
                          <StageChip stage={p.stage} />
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{p.brandsInCommon}</td>
                        <td className="py-2.5 text-right tabular-nums">{p.unitsInBrands.toLocaleString("en-GB")}</td>
                        <td className="py-2.5 pl-4 text-xs text-ink-soft">{[whatsappLink(p.whatsapp) && "WhatsApp", p.email && "Email", p.phone && "Phone"].filter(Boolean).join(" · ") || "Social only"}</td>
                        <td className="py-2.5 text-ink-soft">{p.city ?? "—"}</td>
                        <td className={cn("py-2.5 pr-4 text-xs", due ? "font-semibold text-sale" : "text-ink-muted")}>
                          {p.followUpAt && !["WON", "LOST"].includes(p.stage) ? day(p.followUpAt) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!prospects.length && <p className="p-6 text-center text-sm text-ink-muted">No stores match.</p>}
            </div>
          )}

          <details className="rounded-xl border border-line bg-white p-5">
            <summary className="cursor-pointer text-[15px] font-semibold">Add a store by hand</summary>
            <form action={addProspectAction} className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              {(
                [
                  ["name", "Store or brand name *"],
                  ["website", "Website"],
                  ["city", "City"],
                  ["whatsapp", "WhatsApp"],
                  ["phone", "Phone"],
                  ["email", "Email"],
                  ["instagram", "Instagram"],
                  ["ourBrands", "Our brands they sell (comma-separated)"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="block text-xs text-ink-muted">
                  {label}
                  <input name={k} required={k === "name"} className="input mt-1 w-full text-sm" />
                </label>
              ))}
              <label className="block text-xs text-ink-muted">
                Priority
                <select name="priority" defaultValue="Medium" className="input mt-1 w-full text-sm">
                  {["High", "Medium", "Low", "Check first"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-3">
                <button className="btn-primary">Add store</button>
              </div>
            </form>
          </details>
        </>
      )}
    </div>
  );
}
