"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markEmail, refreshInbox, sendReply } from "@/app/actions/mail";
import { cn } from "@/lib/utils";

/** Inbox → "Check for new email": reads every mailbox now. */
export function RefreshInbox() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2 text-sm">
      {msg && <span className="text-ink-muted" role="status">{msg}</span>}
      <button
        type="button"
        className="btn-primary px-4"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await refreshInbox();
            setMsg(res.message ?? null);
            router.refresh();
          })
        }
      >
        {pending ? "Checking…" : "Check for new email"}
      </button>
    </span>
  );
}

export function MarkUnread({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="underline underline-offset-4"
      onClick={() =>
        start(async () => {
          await markEmail(id, false);
          router.push("/admin/inbox");
        })
      }
    >
      Mark as unread
    </button>
  );
}

/** Reply from the mailbox the email arrived in; a copy goes to that mailbox's Sent folder. */
export function ReplyBox({ id, to, from, repliedAt }: { id: string; to: string; from: string; repliedAt: string | null }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <section className="card p-5">
      <h2 className="font-medium">Reply</h2>
      <p className="mt-0.5 text-xs text-ink-muted">
        To {to}, from {from}.
        {repliedAt && ` Last replied ${new Date(repliedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`}
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={7}
        className="input mt-3"
        placeholder="Write your reply…"
        aria-label="Reply"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={pending || !body.trim()}
          onClick={() =>
            start(async () => {
              const res = await sendReply(id, body);
              setMsg({ ok: res.ok, text: res.message ?? "" });
              if (res.ok) {
                setBody("");
                router.refresh();
              }
            })
          }
        >
          {pending ? "Sending…" : "Send reply"}
        </button>
        {msg && <span className={cn("text-sm", msg.ok ? "text-success" : "text-sale")} role="status">{msg.text}</span>}
      </div>
    </section>
  );
}
