"use client";

import { useActionState } from "react";
import { submitRefund, type FormState } from "@/app/actions/contact";

const init: FormState = { ok: false, message: "" };

export function RefundForm() {
  const [state, action, pending] = useActionState(submitRefund, init);

  if (state.ok) {
    return <p className="border border-success/40 bg-success/5 p-4 text-sm text-success">{state.message}</p>;
  }

  return (
    <form action={action} className="space-y-4">
      {state.message && <p className="text-sm text-sale">{state.message}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="orderNumber">Order number</label>
          <input id="orderNumber" name="orderNumber" placeholder="e.g. UL-XXXXXX" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="subject">Subject</label>
        <input id="subject" name="subject" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="reason">Reason for return / refund</label>
        <textarea id="reason" name="reason" rows={5} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="attachment">Attachment URL (optional)</label>
        <input id="attachment" name="attachment" type="url" placeholder="Link to a photo of the item" className="input" />
        <p className="mt-1 text-xs text-ink-muted">Upload your photo elsewhere and paste the link, or email it to us directly.</p>
      </div>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
