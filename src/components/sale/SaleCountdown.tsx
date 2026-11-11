"use client";

import { useEffect, useState } from "react";

const MINUTE = 60_000;

/** Days, hours and minutes left, each as two digits. */
function left(ms: number) {
  const total = Math.max(0, Math.floor(ms / MINUTE));
  const d = Math.min(99, Math.floor(total / 1440));
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  return [d, h, m].map((n) => String(n).padStart(2, "0"));
}

/**
 * "SALE ENDS" with the days, hours and minutes left, each digit on its own tile, on the 11.11 sale page
 * (lib/sale.ts). The first render uses the server's clock (`now`), so the page arrives with the right numbers;
 * the browser then keeps it ticking, re-checking every second so each minute turns over on time.
 */
export function SaleCountdown({ ends, now }: { ends: number; now: number }) {
  const [current, setCurrent] = useState(now);
  useEffect(() => {
    setCurrent(Date.now());
    const t = setInterval(() => setCurrent(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const parts = left(ends - current);
  const labels = ["days", "hours", "minutes"];
  const [d, h, m] = parts.map(Number);
  const spoken = `Sale ends in ${d} ${d === 1 ? "day" : "days"}, ${h} ${h === 1 ? "hour" : "hours"} and ${m} ${m === 1 ? "minute" : "minutes"}`;

  return (
    <div className="w-fit rounded-2xl border border-line bg-white px-5 py-4 shadow-[0_6px_24px_rgba(0,0,0,0.06)]">
      <p className="text-sm font-semibold uppercase tracking-[0.12em]">Sale ends</p>
      {/* read out once as a sentence, not tile by tile, and not every minute */}
      <p className="sr-only">{spoken}</p>
      <div aria-hidden className="mt-3 flex items-start gap-1.5">
        {parts.map((pair, i) => (
          <div key={labels[i]} className="flex items-start gap-1.5">
            {i > 0 && (
              <span className="flex h-12 items-center text-2xl font-medium text-ink-muted">
                :
              </span>
            )}
            <div>
              <div className="flex gap-1">
                {pair.split("").map((digit, j) => (
                  <span
                    key={j}
                    className="flex h-12 w-9 items-center justify-center rounded-md bg-line-soft text-2xl font-medium tabular-nums"
                  >
                    {digit}
                  </span>
                ))}
              </div>
              <span className="mt-1.5 block text-xs text-ink-muted">{labels[i]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
