"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmPayment } from "@/app/actions/admin-orders";
import { cn } from "@/lib/utils";

/**
 * "Payment received" tick for an order whose payment is pending. Ticking it (after a confirm) marks the order
 * paid, starts preparing it and emails the customer (lib/payments/confirm.ts).
 */
export function PaymentReceivedTick({
  orderNumber,
  amount,
  method,
  compact,
}: {
  orderNumber: string;
  amount: string;
  method: string;
  /** Short label, for the orders list. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function tick() {
    if (!window.confirm(`Confirm that ${amount} by ${method} has arrived for order ${orderNumber}?\n\nThe order will be marked paid and the customer will be emailed.`)) return;
    setMsg(null);
    start(async () => {
      const res = await confirmPayment(orderNumber);
      setDone(res.ok);
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Payment confirmed." : "Couldn't confirm the payment.") });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div>
      <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm", compact && "text-xs", pending && "opacity-60")}>
        <input type="checkbox" checked={done} disabled={done || pending} onChange={tick} className="h-4 w-4 accent-ink" />
        {pending ? "Confirming…" : compact ? "Received" : "Payment received"}
      </label>
      {msg && !compact && <p className={cn("mt-2 text-sm", msg.ok ? "text-success" : "text-sale")}>{msg.text}</p>}
      {msg && compact && !msg.ok && <p className="mt-1 text-xs text-sale">{msg.text}</p>}
    </div>
  );
}
