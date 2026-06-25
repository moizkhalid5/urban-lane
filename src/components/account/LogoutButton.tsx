"use client";

import { logoutUser } from "@/app/actions/session";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutUser}>
      <button type="submit" className={className ?? "text-sm text-ink-muted hover:text-ink"}>
        Log out
      </button>
    </form>
  );
}
