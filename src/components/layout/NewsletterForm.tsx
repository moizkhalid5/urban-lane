"use client";

import { useActionState } from "react";
import { subscribeNewsletter, type ActionState } from "@/app/actions/newsletter";

const initial: ActionState = { ok: false, message: "" };

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeNewsletter, initial);

  return (
    <div>
      <form action={action} className="flex max-w-md gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="Enter your email"
          aria-label="Email address"
          className="input border-ink/20 bg-transparent text-white placeholder:text-white/50 focus:border-white"
        />
        <button type="submit" disabled={pending} className="btn bg-white text-ink hover:bg-white/90">
          {pending ? "…" : "Subscribe"}
        </button>
      </form>
      {state.message && (
        <p className={`mt-2 text-sm ${state.ok ? "text-white" : "text-white/70"}`}>{state.message}</p>
      )}
    </div>
  );
}
