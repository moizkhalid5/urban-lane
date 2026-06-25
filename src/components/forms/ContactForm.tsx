"use client";

import { useActionState } from "react";
import { submitContact, type FormState } from "@/app/actions/contact";

const init: FormState = { ok: false, message: "" };

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, init);

  if (state.ok) {
    return <p className="border border-success/40 bg-success/5 p-4 text-sm text-success">{state.message}</p>;
  }

  return (
    <form action={action} className="space-y-4">
      {state.message && <p className="text-sm text-sale">{state.message}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="subject">Subject</label>
        <input id="subject" name="subject" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="message">Message</label>
        <textarea id="message" name="message" rows={5} required className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
