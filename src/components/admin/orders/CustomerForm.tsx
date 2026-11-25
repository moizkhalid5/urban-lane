"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCustomer } from "@/app/actions/admin-manual-orders";

const FIELDS = [
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["phone", "Phone / WhatsApp"],
  ["email", "Email (optional)"],
  ["line1", "Address (optional)"],
  ["line2", "Area / apartment (optional)"],
  ["city", "City"],
  ["postalCode", "Postcode (optional)"],
] as const;

type Form = Record<(typeof FIELDS)[number][0], string>;

/** Admin → Customers → Add customer. */
export function CustomerForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ firstName: "", lastName: "", phone: "", email: "", line1: "", line2: "", city: "", postalCode: "" });
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);

  function save(thenOrder: boolean) {
    setError(null);
    start(async () => {
      const res = await createCustomer({ ...form, acceptsMarketing });
      if (!res.ok || !res.id) return setError(res.message ?? "Couldn't add the customer.");
      router.push(thenOrder ? `/admin/orders/new?customer=${res.id}` : `/admin/customers/${res.id}`);
    });
  }

  return (
    <div className="card max-w-2xl space-y-5 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([k, label]) => (
          <div key={k}>
            <label className="label" htmlFor={`c-${k}`}>{label}</label>
            <input
              id={`c-${k}`}
              type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
              value={form[k]}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              className="input"
            />
          </div>
        ))}
      </div>
      {form.email.trim() && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={acceptsMarketing} onChange={(e) => setAcceptsMarketing(e.target.checked)} />
          <span>They agreed to get offers by email (only tick if they said yes)</span>
        </label>
      )}
      <p className="text-xs text-ink-muted">
        No password is set. If they have an email, they can make one with “Forgot password” and see their orders. Customers without
        an email are never emailed.
      </p>
      {error && <p className="text-sm text-sale" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => save(false)} disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Add customer"}
        </button>
        <button type="button" onClick={() => save(true)} disabled={pending} className="btn-secondary">
          Add and create an order
        </button>
      </div>
    </div>
  );
}
