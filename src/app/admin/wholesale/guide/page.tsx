import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { getMailboxes, mailboxFor } from "@/lib/mail/accounts";
import { getWholesaleSettings, wholesaleListUrl } from "@/lib/wholesale/prospects";
import { importAction, saveSettingsAction } from "../actions";
import { PITCH_GUIDE } from "./content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pitch guide & settings — Urban Lane admin" };

/** Admin → Wholesale → Pitch guide & settings: what fills the pitches, the discount tiers, and importing stores. */
export default async function GuidePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const { saved } = await searchParams;
  const [s, boxes, marketing] = await Promise.all([getWholesaleSettings(), getMailboxes(), mailboxFor("marketing")]);
  const ready = boxes.filter((b) => b.password);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/admin/wholesale" className="text-sm text-ink-muted hover:text-ink">
          ← Wholesale
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Pitch guide &amp; settings</h1>
        <p className="mt-1 text-sm text-ink-muted">What fills in your messages, your bulk discount tiers, and how to sell wholesale.</p>
      </div>
      {saved && <p className="border border-success/30 bg-success/5 px-4 py-3 text-sm">Saved. Your messages now use these details.</p>}

      <form action={saveSettingsAction} className="space-y-5 rounded-xl border border-line bg-white p-5">
        <h2 className="text-[15px] font-semibold">Your details in every message</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" hint="Replaces [Your name]">
            <input name="yourName" defaultValue={s.yourName} className="input w-full" />
          </Field>
          <Field label="Your WhatsApp number" hint="Replaces [Your WhatsApp number], e.g. 0332 5253799">
            <input name="yourWhatsApp" defaultValue={s.yourWhatsApp} className="input w-full" />
          </Field>
          <Field label="Send emails from" hint={ready.length ? "A mailbox set up in Settings → Email" : "No mailbox has a password yet: Settings → Email"}>
            <select name="mailbox" defaultValue={s.mailbox} className="input w-full">
              <option value="">{marketing ? `Marketing mailbox (${marketing.address})` : "Marketing mailbox"}</option>
              {ready.map((b) => (
                <option key={b.address} value={b.address}>
                  {b.address}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Wholesale list link" hint="Used in the messages. Leave empty to use our wholesale page (/wholesale), which shows live stock and prices.">
            <input name="listUrl" defaultValue={s.listUrl} placeholder={wholesaleListUrl({ ...s, listUrl: "" })} className="input w-full" />
          </Field>
          <Field label="Follow up after (days)" hint="After a first message, the store is due again after this many days">
            <input type="number" name="followUpDays" min={1} max={30} defaultValue={s.followUpDays} className="input w-32" />
          </Field>
        </div>

        <div>
          <h2 className="text-[15px] font-semibold">Bulk discount tiers</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Leave all empty to use the wholesale page&apos;s offer (40% off; flat 50% off on 100+ pieces) in the messages. Tiers filled in here
            replace it in the messages only; the wholesale page always shows 40% / 50%.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-ink-muted">
                <tr>
                  <th className="pb-2 font-normal">Tier</th>
                  <th className="pb-2 font-normal">Minimum pieces</th>
                  <th className="pb-2 font-normal">Discount off retail (%)</th>
                  <th className="pb-2 font-normal">Notes</th>
                </tr>
              </thead>
              <tbody>
                {s.tiers.map((t, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2">
                      <input name={`tier${i}name`} defaultValue={t.name} className="input w-28" />
                    </td>
                    <td className="py-1 pr-2">
                      <input name={`tier${i}min`} defaultValue={t.minPieces} inputMode="numeric" className="input w-32" />
                    </td>
                    <td className="py-1 pr-2">
                      <input name={`tier${i}discount`} defaultValue={t.discount} inputMode="decimal" className="input w-32" />
                    </td>
                    <td className="py-1">
                      <input name={`tier${i}notes`} defaultValue={t.notes} className="input w-full" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <button className="btn-primary">Save settings</button>
      </form>

      <form action={importAction} className="flex flex-wrap items-end gap-4 rounded-xl border border-line bg-white p-5">
        <div>
          <h2 className="text-[15px] font-semibold">Import stores</h2>
          <p className="mt-1 text-xs text-ink-muted">
            The prospects file made from your research sheet (.json). Stores already here get their research refreshed; their
            conversations and stages are kept.
          </p>
          <input type="file" name="file" accept=".json,application/json" required className="mt-3 block text-sm" />
        </div>
        <button className="btn-secondary">Import</button>
      </form>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-[15px] font-semibold">Pitch guide</h2>
        <div className="mt-3 grid gap-5 text-sm md:grid-cols-2">
          {PITCH_GUIDE.map((g) => (
            <div key={g.heading}>
              <p className="font-medium">{g.heading}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-soft">
                {g.points.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
