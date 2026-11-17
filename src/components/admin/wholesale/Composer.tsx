"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { logEntryAction, logWhatsApp, sendEmailAction, type ActionResult } from "@/app/admin/wholesale/actions";

/**
 * The message box under a prospect's conversation: send on WhatsApp (opens WhatsApp with the text and
 * records it), send an email (really sent), paste their reply, log a call, or add a note. Templates fill
 * the box; everything stays editable.
 */
type Template = { key: string; label: string; subject: string; body: string };
type Tab = "whatsapp" | "email" | "reply" | "call" | "note";

const TABS: { key: Tab; label: string }[] = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "reply", label: "Their reply" },
  { key: "call", label: "Call" },
  { key: "note", label: "Note" },
];

/** wa.me link with the text (mirror of lib/wholesale/prospects.ts whatsappLink, for the browser). */
function waLink(base: string, text: string) {
  if (/wa\.me\/message\//i.test(base)) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function Composer({
  prospectId,
  waBase,
  email,
  phone,
  templates,
  placeholdersLeft,
}: {
  prospectId: string;
  /** https://wa.me/<number> or the store's own wa.me link; null when they have no WhatsApp */
  waBase: string | null;
  email: string | null;
  phone: string | null;
  templates: Template[];
  /** true while [Your name] etc. aren't set in the settings */
  placeholdersLeft: boolean;
}) {
  const [tab, setTab] = useState<Tab>(waBase ? "whatsapp" : email ? "email" : "reply");
  const [tpl, setTpl] = useState(templates[0]?.key ?? "");
  const current = templates.find((t) => t.key === tpl) ?? templates[0];
  const [text, setText] = useState(current?.body ?? "");
  const [subject, setSubject] = useState(current?.subject ?? "");
  const [waResult, setWaResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [emailResult, emailAction, emailPending] = useActionState(sendEmailAction, null);
  const [logResult, logAction, logPending] = useActionState(logEntryAction, null);

  const pick = (key: string) => {
    const t = templates.find((x) => x.key === key);
    setTpl(key);
    if (t) {
      setText(t.body);
      setSubject(t.subject);
    }
  };

  const templatePicker = (
    <label className="block text-xs text-ink-muted">
      Template
      <select value={tpl} onChange={(e) => pick(e.target.value)} className="input mt-1 w-full text-sm">
        {templates.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
  const Result = ({ r }: { r: ActionResult | null }) =>
    r ? <p className={cn("text-sm", r.ok ? "text-success" : "text-sale")}>{r.message}</p> : null;

  return (
    <div className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap gap-1 border-b border-line p-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("rounded-full px-3.5 py-1.5 text-sm", tab === t.key ? "bg-ink text-white" : "text-ink-soft hover:bg-line-soft")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-4">
        {placeholdersLeft && (tab === "whatsapp" || tab === "email") && (
          <p className="rounded bg-[#fff4d6] px-3 py-2 text-xs text-[#7a5200]">
            Add your name and WhatsApp number in <Link href="/admin/wholesale/guide" className="underline">Pitch guide &amp; settings</Link> so they fill in [Your name] and [Your WhatsApp number] automatically.
          </p>
        )}

        {tab === "whatsapp" &&
          (waBase ? (
            <>
              {templatePicker}
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={11} className="input w-full text-sm leading-relaxed" />
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={waLink(waBase, text)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => start(async () => setWaResult(await logWhatsApp(prospectId, text)))}
                  className={cn("btn-primary inline-flex items-center gap-2 bg-[#128c4b] hover:bg-[#0e7a40]", pending && "opacity-60")}
                >
                  Open WhatsApp &amp; record as sent
                </a>
                <button type="button" onClick={() => navigator.clipboard?.writeText(text)} className="text-sm underline underline-offset-4">
                  Copy text
                </button>
              </div>
              <p className="text-xs text-ink-muted">WhatsApp opens with this message ready: press send there. If you don&apos;t send it, add a note to say so.</p>
              <Result r={waResult} />
            </>
          ) : (
            <p className="text-sm text-ink-muted">No WhatsApp number for this store. Add one under Contact details, or use Email.</p>
          ))}

        {tab === "email" &&
          (email ? (
            <form action={emailAction} className="space-y-3">
              <input type="hidden" name="prospectId" value={prospectId} />
              {templatePicker}
              <label className="block text-xs text-ink-muted">
                To
                <input value={email.split(/[;,\s]+/)[0]} readOnly className="input mt-1 w-full bg-line-soft text-sm" />
              </label>
              <label className="block text-xs text-ink-muted">
                Subject
                <input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="input mt-1 w-full text-sm" />
              </label>
              <textarea name="body" value={text} onChange={(e) => setText(e.target.value)} rows={11} className="input w-full text-sm leading-relaxed" />
              <button className="btn-primary" disabled={emailPending}>
                {emailPending ? "Sending…" : "Send email"}
              </button>
              <Result r={emailResult} />
            </form>
          ) : (
            <p className="text-sm text-ink-muted">No email address for this store. Add one under Contact details, or use WhatsApp.</p>
          ))}

        {(tab === "reply" || tab === "call" || tab === "note") && (
          <form action={logAction} className="space-y-3" key={tab}>
            <input type="hidden" name="prospectId" value={prospectId} />
            <input type="hidden" name="direction" value={tab === "reply" ? "IN" : tab === "call" ? "OUT" : "NONE"} />
            {tab === "reply" ? (
              <label className="block text-xs text-ink-muted">
                Where did they reply?
                <select name="kind" defaultValue="WHATSAPP" className="input mt-1 w-full text-sm">
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="CALL">On a call</option>
                  <option value="EMAIL">Email (if it didn&apos;t reach the Inbox)</option>
                  <option value="NOTE">In person / other</option>
                </select>
              </label>
            ) : (
              <input type="hidden" name="kind" value={tab === "call" ? "CALL" : "NOTE"} />
            )}
            <textarea
              name="body"
              rows={6}
              className="input w-full text-sm leading-relaxed"
              placeholder={
                tab === "reply"
                  ? "Paste their WhatsApp message, or write what they said…"
                  : tab === "call"
                    ? "Who you spoke to and what was agreed…"
                    : "A note for yourself (only you see it)…"
              }
            />
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-primary" disabled={logPending}>
                {tab === "reply" ? "Save their reply" : tab === "call" ? "Save the call" : "Save note"}
              </button>
              {tab === "call" && phone && (
                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-sm underline underline-offset-4">
                  Call {phone}
                </a>
              )}
            </div>
            <Result r={logResult} />
          </form>
        )}
      </div>
    </div>
  );
}
