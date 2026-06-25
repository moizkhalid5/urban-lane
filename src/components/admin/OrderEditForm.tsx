"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrder } from "@/app/actions/admin-orders";

const PAYMENT = ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];
const FULFILLMENT = ["UNFULFILLED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];

export function OrderEditForm({
  orderNumber,
  initial,
}: {
  orderNumber: string;
  initial: {
    paymentStatus: string;
    fulfillmentStatus: string;
    trackingNumber: string;
    trackingCarrier: string;
    adminNote: string;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState(initial);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    setMsg(null);
    start(async () => {
      const res = await updateOrder(orderNumber, form);
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Saved." : "Error.") });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-medium">Update order</h2>
      {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-sale"}`}>{msg.text}</p>}

      <div>
        <label className="label">Payment status</label>
        <select value={form.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)} className="input">
          {PAYMENT.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Fulfillment status</label>
        <select value={form.fulfillmentStatus} onChange={(e) => set("fulfillmentStatus", e.target.value)} className="input">
          {FULFILLMENT.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <p className="mt-1 text-xs text-ink-muted">Changing this emails the customer.</p>
      </div>
      <div>
        <label className="label">Tracking number</label>
        <input value={form.trackingNumber} onChange={(e) => set("trackingNumber", e.target.value)} className="input" />
      </div>
      <div>
        <label className="label">Carrier</label>
        <input value={form.trackingCarrier} onChange={(e) => set("trackingCarrier", e.target.value)} className="input" />
      </div>
      <div>
        <label className="label">Admin notes (internal)</label>
        <textarea value={form.adminNote} onChange={(e) => set("adminNote", e.target.value)} rows={3} className="input" />
      </div>
      <button onClick={save} disabled={pending} className="btn-primary w-full">
        {pending ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
