"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/** A button that confirms, runs a server action, then refreshes. */
export function ConfirmButton({
  action,
  confirm,
  children,
  className,
}: {
  action: () => Promise<{ ok: boolean; message?: string }>;
  confirm?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onClick() {
    if (confirm && !window.confirm(confirm)) return;
    start(async () => {
      const res = await action();
      if (!res.ok && res.message) alert(res.message);
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={onClick} disabled={pending} className={className}>
      {pending ? "…" : children}
    </button>
  );
}
