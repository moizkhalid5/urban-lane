"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const params = useSearchParams();
  const pathname = usePathname();
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );

  return (
    <nav className="mt-12 flex items-center justify-center gap-1" aria-label="Pagination">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className="border border-line px-3 py-2 text-sm hover:border-ink">
          Prev
        </Link>
      )}
      {pages.map((p, i) => {
        const prev = pages[i - 1];
        const gap = prev && p - prev > 1;
        return (
          <span key={p} className="flex items-center">
            {gap && <span className="px-2 text-ink-muted">…</span>}
            <Link
              href={hrefFor(p)}
              className={cn(
                "min-w-10 border px-3 py-2 text-center text-sm",
                p === page ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
              )}
            >
              {p}
            </Link>
          </span>
        );
      })}
      {page < totalPages && (
        <Link href={hrefFor(page + 1)} className="border border-line px-3 py-2 text-sm hover:border-ink">
          Next
        </Link>
      )}
    </nav>
  );
}
