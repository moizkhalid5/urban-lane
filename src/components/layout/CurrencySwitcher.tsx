"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setCurrency } from "@/app/actions/currency";
import { cn } from "@/lib/utils";

type CurrencyOption = { code: string; symbol: string; flag: string };

export function CurrencySwitcher({
  currencies,
  active,
  openUp = false,
}: {
  currencies: CurrencyOption[];
  active: string;
  /** Open the list above the button (e.g. at the bottom of the mobile menu). */
  openUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = currencies.find((c) => c.code === active) ?? currencies[0];

  function choose(code: string) {
    setOpen(false);
    startTransition(async () => {
      await setCurrency(code);
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className="flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {/* No flag emoji: Windows can't draw flags and shows letters ("PK", "EU") instead. */}
        <span>{current?.code}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-60">
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className={cn(
            "absolute right-0 z-50 min-w-[8rem] border border-line bg-white py-1 shadow-sm",
            openUp ? "bottom-full mb-2" : "mt-2",
          )}
        >
          {currencies.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => choose(c.code)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-line-soft",
                  c.code === active ? "font-medium text-ink" : "text-ink-soft",
                )}
              >
                <span>{c.code}</span>
                <span className="ml-auto text-ink-muted">{c.symbol}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
