"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCampaign, saveCampaign, sendCampaignBatch, sendCampaignTest, startCampaignSend } from "@/app/actions/mail";
import { cn } from "@/lib/utils";

type Audience = "subscribers" | "customers" | "both";
type Draft = {
  id?: string;
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  imageUrl: string;
  buttonText: string;
  buttonUrl: string;
  audience: Audience;
};

const EMPTY: Draft = {
  subject: "",
  preheader: "",
  heading: "",
  body: "",
  imageUrl: "",
  buttonText: "Shop now",
  buttonUrl: "/",
  audience: "both",
};

/** Admin → Marketing → campaign: the words, picture, button and who gets it. Saved as a draft until sent. */
export function CampaignEditor({
  initial,
  locked,
  audiences,
}: {
  initial: Draft | null;
  locked: boolean;
  audiences: { value: Audience; label: string; count: number }[];
}) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(initial ?? EMPTY);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const field = (k: keyof Draft, label: string, hint?: string, area = false) => (
    <label className="block">
      <span className="label">{label}</span>
      {area ? (
        <textarea value={d[k] as string} onChange={(e) => set(k, e.target.value)} rows={9} className="input" disabled={locked} />
      ) : (
        <input value={d[k] as string} onChange={(e) => set(k, e.target.value)} className="input" disabled={locked} />
      )}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );

  return (
    <section className="card space-y-4 p-5">
      {locked && <p className="text-sm text-ink-muted">This campaign has been sent, so it can&apos;t be changed.</p>}
      {field("subject", "Subject line", "What people see in their inbox.")}
      {field("preheader", "Preview text (optional)", "The grey line after the subject in most inboxes.")}
      {field("heading", "Heading")}
      {field("body", "Message", "Leave an empty line between paragraphs.", true)}
      {field("imageUrl", "Picture link (optional)", "A banner or product photo, e.g. https://urbanlane.uk/images/… (copy it from the shop).")}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("buttonText", "Button text (optional)")}
        {field("buttonUrl", "Button link", "A shop page, e.g. /collections/women or /offers.")}
      </div>
      <label className="block">
        <span className="label">Send to</span>
        <select value={d.audience} onChange={(e) => set("audience", e.target.value as Audience)} className="input" disabled={locked}>
          {audiences.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label} ({a.count})
            </option>
          ))}
        </select>
      </label>
      {!locked && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await saveCampaign(d);
                setMsg({ ok: res.ok, text: res.message ?? "" });
                if (res.ok && res.id) {
                  if (!d.id) router.replace(`/admin/marketing/${res.id}`);
                  else router.refresh();
                  setD((x) => ({ ...x, id: res.id }));
                }
              })
            }
          >
            {pending ? "Saving…" : "Save draft"}
          </button>
          {d.id && (
            <button
              type="button"
              className="text-sm text-sale underline underline-offset-4"
              disabled={pending}
              onClick={() => {
                if (!confirm("Delete this draft?")) return;
                start(async () => {
                  const res = await deleteCampaign(d.id!);
                  if (res.ok) router.push("/admin/marketing");
                  else setMsg({ ok: false, text: res.message ?? "" });
                });
              }}
            >
              Delete draft
            </button>
          )}
          {msg && <span className={cn("text-sm", msg.ok ? "text-success" : "text-sale")} role="status">{msg.text}</span>}
        </div>
      )}
    </section>
  );
}

/** Test email, then "Send to N people", sent in small batches with progress; a stopped send can carry on. */
export function CampaignSender({
  id,
  status,
  sender,
  ready,
  recipients,
  sent: sentBefore,
  failed: failedBefore,
  testTo,
  failures,
}: {
  id: string;
  status: string;
  sender: string;
  ready: boolean;
  recipients: number;
  sent: number;
  failed: number;
  testTo: string;
  failures: { email: string; error: string | null }[];
}) {
  const router = useRouter();
  const [to, setTo] = useState(testTo);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);

  async function run(total: number) {
    for (;;) {
      const r = await sendCampaignBatch(id);
      if (!r.ok) {
        setMsg({ ok: false, text: `${r.message} Sending stopped; you can carry on later.` });
        break;
      }
      setProgress({ sent: r.sent, failed: r.failed, total });
      if (r.done) {
        setMsg({ ok: true, text: `Done: sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}${r.failed ? `, ${r.failed} failed` : ""}.` });
        break;
      }
    }
    router.refresh();
  }

  if (status === "SENT")
    return (
      <section className="card p-5 text-sm">
        <h2 className="font-medium">Sent</h2>
        <p className="mt-1">
          Sent to {sentBefore} {sentBefore === 1 ? "person" : "people"} from {sender}.
          {failedBefore > 0 && <span className="text-sale"> {failedBefore} couldn&apos;t be sent.</span>}
        </p>
        {failures.length > 0 && (
          <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-xs text-ink-muted">
            {failures.map((f) => (
              <li key={f.email}>
                {f.email}: {f.error}
              </li>
            ))}
          </ul>
        )}
      </section>
    );

  return (
    <section className="card space-y-4 p-5 text-sm">
      <h2 className="font-medium">Send</h2>
      {!ready && <p className="text-sale">{sender} isn&apos;t connected yet: add its password in Settings → Email.</p>}
      <div>
        <span className="label">Send a test first</span>
        <div className="flex gap-2">
          <input value={to} onChange={(e) => setTo(e.target.value)} className="input" aria-label="Test address" />
          <button
            type="button"
            className="btn-ghost shrink-0 px-4"
            disabled={pending || !ready}
            onClick={() =>
              start(async () => {
                const res = await sendCampaignTest(id, to);
                setMsg({ ok: res.ok, text: res.message ?? "" });
              })
            }
          >
            Send test
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-muted">Save first: the test is the saved version, marked [Test].</p>
      </div>
      <div className="border-t border-line pt-4">
        {status === "SENDING" ? (
          <p className="mb-2">Sending stopped part-way: {sentBefore} sent so far. Carry on to send to the rest.</p>
        ) : (
          <p className="mb-2">
            Goes to {recipients} {recipients === 1 ? "person" : "people"} from {sender}. Sent campaigns can&apos;t be changed.
          </p>
        )}
        <button
          type="button"
          className="btn-primary w-full"
          disabled={pending || !ready || (status === "DRAFT" && recipients === 0)}
          onClick={() => {
            if (status === "DRAFT" && !confirm(`Send this campaign to ${recipients} people now?`)) return;
            start(async () => {
              setMsg(null);
              const res = await startCampaignSend(id);
              if (!res.ok) return setMsg({ ok: false, text: res.message ?? "" });
              setProgress({ sent: sentBefore, failed: failedBefore, total: res.total ?? recipients });
              await run(res.total ?? recipients);
            });
          }}
        >
          {pending && progress ? "Sending…" : status === "SENDING" ? "Carry on sending" : `Send to ${recipients} ${recipients === 1 ? "person" : "people"}`}
        </button>
        {progress && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded bg-line-soft" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.sent + progress.failed}>
              <div className="h-full bg-ink transition-all" style={{ width: `${(100 * (progress.sent + progress.failed)) / Math.max(1, progress.total)}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {progress.sent} of {progress.total} sent{progress.failed ? `, ${progress.failed} failed` : ""}. Keep this page open until it finishes.
            </p>
          </div>
        )}
      </div>
      {msg && <p className={msg.ok ? "text-success" : "text-sale"} role="status">{msg.text}</p>}
    </section>
  );
}
