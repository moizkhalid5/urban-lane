"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 10_000;

/**
 * Black-strip messages: one at a time, sliding to the next every 10 seconds
 * (paused while hovered), with ‹ › to switch manually. One message = static text.
 */
export function AnnouncementTicker({ messages, className }: { messages: string[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = messages.length;

  useEffect(() => {
    if (count <= 1 || paused) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [index, count, paused]);

  if (count === 0) return null;
  if (count === 1) return <span className={cn("text-center", className)}>{messages[0]}</span>;

  const go = (step: number) => setIndex((i) => (i + step + count) % count);
  const arrow = "shrink-0 p-1 text-white/70 transition-colors hover:text-white";

  return (
    <div
      className={cn("flex items-center justify-center gap-3", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Store announcements"
    >
      <button type="button" onClick={() => go(-1)} aria-label="Previous announcement" className={arrow}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>

      {/* All messages share one grid cell so the strip keeps the height of the longest one. */}
      <div className="grid min-w-0 flex-1 overflow-hidden sm:w-[28rem] sm:flex-none" aria-live="polite">
        {messages.map((m, i) => (
          <span
            key={i}
            aria-hidden={i !== index}
            className={cn(
              "col-start-1 row-start-1 text-center transition-all duration-500 ease-premium",
              i === index ? "translate-y-0 opacity-100" : i === (index - 1 + count) % count ? "-translate-y-full opacity-0" : "translate-y-full opacity-0",
            )}
          >
            {m}
          </span>
        ))}
      </div>

      <button type="button" onClick={() => go(1)} aria-label="Next announcement" className={arrow}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
