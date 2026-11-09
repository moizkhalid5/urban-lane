"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/inbox", label: "Inbox", adminOnly: true },
  { href: "/admin/marketing", label: "Marketing", adminOnly: true },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/rail", label: "Homepage rail" },
  { href: "/admin/featured", label: "Homepage featured" },
  { href: "/admin/settings", label: "Settings" },
];

/** `isAdmin`: Inbox and Marketing (the shop's email) are for admins only. */
export function AdminNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const unread = useUnreadEmail(isAdmin);
  return (
    <nav className="space-y-1">
      {items.filter((it) => isAdmin || !("adminOnly" in it)).map((it) => {
        const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "block rounded px-3 py-2 text-sm transition-colors",
              active ? "bg-ink text-white" : "text-ink-soft hover:bg-line-soft",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              {it.label}
              {it.href === "/admin/inbox" && unread > 0 && (
                <span
                  className={cn("rounded-full px-1.5 text-[11px] font-semibold leading-5", active ? "bg-white text-ink" : "bg-sale text-white")}
                  aria-label={`${unread} unread`}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Unread emails in the shop's mailboxes, for the Inbox badge: asked for on opening the admin and every
 * minute (the server checks the mailboxes for new mail at the same time). Also shown in the tab title.
 */
function useUnreadEmail(enabled: boolean) {
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/inbox/unread", { cache: "no-store" });
        if (res.ok && !stop) setUnread(((await res.json()) as { unread: number }).unread);
      } catch {
        /* offline: keep the last count */
      }
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [enabled, pathname]);
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\) /, "");
    document.title = unread > 0 ? `(${unread > 99 ? "99+" : unread}) ${base}` : base;
  }, [unread, pathname]);
  return unread;
}
