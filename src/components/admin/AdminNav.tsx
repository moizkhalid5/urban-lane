"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {items.map((it) => {
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
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
