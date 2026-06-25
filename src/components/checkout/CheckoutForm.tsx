"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { placeOrder } from "@/app/actions/checkout";
import { cn } from "@/lib/utils";

export type PaymentOption = { method: string; label: string };
type Prefill = { email?: string; firstName?: string; lastName?: string; phone?: string; line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string };

const COUNTRIES = [
  { code: "PK", name: "Pakistan" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
];

const SHIPPING_METHODS = [
  { value: "standard", label: "Standard (3–5 working days)" },
  { value: "express", label: "Express (1–2 working days)" },
];

export function CheckoutForm({
  paymentMethods,
  bankInstructions,
  prefill,
}: {
  paymentMethods: PaymentOption[];
  bankInstructions?: string | null;
  prefill?: Prefill;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState(paymentMethods[0]?.method ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());

    startTransition(async () => {
      const res = await placeOrder(payload);
      if (res.ok) {
        if (res.redirectUrl) window.location.href = res.redirectUrl;
        else router.push(`/checkout/success/${res.orderNumber}`);
      } else {
        setError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  if (paymentMethods.length === 0) {
    return (
      <p className="border border-line bg-line-soft p-4 text-sm">
        No payment methods are currently enabled. Please contact us to complete your order.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      {error && <p className="border border-sale bg-sale/5 p-3 text-sm text-sale">{error}</p>}

      <fieldset>
        <legend className="mb-4 text-lg font-medium">Contact</legend>
        <Field label="Email" name="email" type="email" required defaultValue={prefill?.email} />
      </fieldset>

      <fieldset>
        <legend className="mb-4 text-lg font-medium">Shipping address</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" name="firstName" required defaultValue={prefill?.firstName} />
          <Field label="Last name" name="lastName" required defaultValue={prefill?.lastName} />
          <Field label="Phone" name="phone" required defaultValue={prefill?.phone} />
          <div>
            <label className="label" htmlFor="country">Country</label>
            <select id="country" name="country" defaultValue={prefill?.country ?? "PK"} className="input">
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address" name="line1" required defaultValue={prefill?.line1} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Apartment, suite, etc. (optional)" name="line2" defaultValue={prefill?.line2} />
          </div>
          <Field label="City" name="city" required defaultValue={prefill?.city} />
          <Field label="State / Province (optional)" name="state" defaultValue={prefill?.state} />
          <Field label="Postal code" name="postalCode" required defaultValue={prefill?.postalCode} />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-4 text-lg font-medium">Shipping method</legend>
        <div className="space-y-2">
          {SHIPPING_METHODS.map((m, i) => (
            <label key={m.value} className="flex cursor-pointer items-center gap-3 border border-line p-4 text-sm">
              <input type="radio" name="shippingMethod" value={m.value} defaultChecked={i === 0} className="accent-ink" />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-4 text-lg font-medium">Payment</legend>
        <div className="space-y-2">
          {paymentMethods.map((m) => (
            <label
              key={m.method}
              className={cn(
                "flex cursor-pointer items-center gap-3 border p-4 text-sm",
                method === m.method ? "border-ink" : "border-line",
              )}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={m.method}
                checked={method === m.method}
                onChange={() => setMethod(m.method)}
                className="accent-ink"
              />
              {m.label}
            </label>
          ))}
        </div>
        {method === "BANK_TRANSFER" && bankInstructions && (
          <p className="mt-3 whitespace-pre-line border border-line bg-line-soft p-4 text-sm text-ink-soft">
            {bankInstructions}
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-4 text-lg font-medium">Order notes & discount</legend>
        <div className="space-y-4">
          <Field label="Discount code (optional)" name="couponCode" />
          <div>
            <label className="label" htmlFor="customerNote">Order notes (optional)</label>
            <textarea id="customerNote" name="customerNote" rows={3} className="input" />
          </div>
        </div>
      </fieldset>

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Placing order…" : "Place order"}
      </button>
      <p className="text-center text-xs text-ink-muted">
        Your card details are never stored. Card payments are processed by the payment provider.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} required={required} defaultValue={defaultValue} className="input" />
    </div>
  );
}
