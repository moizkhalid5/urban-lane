"use client";

import { useState, useTransition } from "react";
import { emailAllNotAsked, markWhatsappSent, sendReviewRequestEmail } from "@/app/actions/review-requests";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null);

/** One delivered order: "Email" and "WhatsApp" review-request buttons with when each was last sent. */
export function ReviewRequestButtons({
  orderNumber,
  emailedAt,
  whatsappAt,
  whatsappHref,
}: {
  orderNumber: string;
  emailedAt: string | null;
  whatsappAt: string | null;
  whatsappHref: string | null;
}) {
  const [pending, start] = useTransition();
  const [emailed, setEmailed] = useState(emailedAt);
  const [whatsapped, setWhatsapped] = useState(whatsappAt);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await sendReviewRequestEmail(orderNumber);
            if (res.ok) setEmailed(new Date().toISOString());
            else setError(res.message ?? "Couldn't send.");
          })
        }
        className="btn-secondary px-3 py-1.5 text-xs"
      >
        {pending ? "Sending…" : emailed ? `Emailed ${when(emailed)} · again` : "Email"}
      </button>
      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            setWhatsapped(new Date().toISOString());
            void markWhatsappSent(orderNumber);
          }}
          className="btn-secondary px-3 py-1.5 text-xs"
        >
          {whatsapped ? `WhatsApp ${when(whatsapped)} · again` : "WhatsApp"}
        </a>
      ) : (
        <span className="text-xs text-ink-muted">No mobile number</span>
      )}
      {error && <span className="text-xs text-sale">{error}</span>}
    </div>
  );
}

/** "Email all N customers not asked yet" (up to 100 per click). */
export function EmailAllButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (count === 0) {
    // After "Email all" the list refreshes to 0; keep the result visible
    return <p className={`text-sm ${msg ? "text-success" : "text-ink-muted"}`}>{msg ?? "Every delivered order has been asked. 🎉"}</p>;
  }
  const batch = Math.min(count, 100);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Email ${batch} customers asking them to rate their order?`)) return;
          start(async () => setMsg((await emailAllNotAsked(100)).message ?? null));
        }}
        className="btn-primary"
      >
        {pending ? "Sending…" : `Email ${batch} customer${batch === 1 ? "" : "s"} not asked yet`}
      </button>
      {count > 100 && <span className="text-sm text-ink-muted">({count} in total; 100 per click so the mail host doesn&apos;t block us)</span>}
      {msg && <span className="text-sm text-success">{msg}</span>}
    </div>
  );
}
