"use client";

import { useState, useTransition } from "react";
import { unsubscribeAction } from "@/app/actions/mail";

export function UnsubscribeButton({ email, token }: { email: string; token: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  if (result?.ok) return <p className="mt-6 text-success" role="status">{result.message}</p>;
  return (
    <div className="mt-6">
      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() => start(async () => setResult(await unsubscribeAction(email, token)))}
      >
        {pending ? "Unsubscribing…" : "Unsubscribe"}
      </button>
      {result && !result.ok && <p className="mt-3 text-sm text-sale" role="status">{result.message}</p>}
    </div>
  );
}
