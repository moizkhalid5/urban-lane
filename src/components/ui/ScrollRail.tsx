"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Horizontal scroller with prev/next buttons (always visible, dimmed at the ends).
 * Each child becomes one slot; `itemClassName` sets slot widths per breakpoint.
 * Scrolls one viewport ("page") per click; touch/trackpad scrolling also works.
 */
export function ScrollRail({
  children,
  itemClassName,
  label,
}: {
  children: ReactNode;
  itemClassName: string;
  label: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const scroll = (dir: 1 | -1) => {
    const el = scroller.current;
    el?.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  const button =
    "absolute top-[40%] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink shadow-md ring-1 ring-black/5 transition hover:bg-line-soft disabled:cursor-default disabled:opacity-40 md:h-11 md:w-11 xl:bg-line-soft xl:shadow-sm";

  return (
    <div className="relative">
      <div ref={scroller} onScroll={measure} className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth">
        {Children.map(children, (child) => (
          <div className={cn("shrink-0 snap-start", itemClassName)}>{child}</div>
        ))}
      </div>
      <button type="button" onClick={() => scroll(-1)} disabled={atStart} aria-label={`Previous ${label}`} className={cn(button, "left-2 xl:-left-[calc(clamp(1rem,4vw,4rem)_-_0.5rem)]")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <button type="button" onClick={() => scroll(1)} disabled={atEnd} aria-label={`Next ${label}`} className={cn(button, "right-2 xl:-right-[calc(clamp(1rem,4vw,4rem)_-_0.5rem)]")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
