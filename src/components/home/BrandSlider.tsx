"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type BrandSlide = { name: string; slug: string; banner: string | null };

/**
 * "Shop by brand" carousel: tall rounded cards (the brand's logo is part of each image),
 * round prev/next buttons either side and page dots underneath. Scrolls a page at a time.
 */
export function BrandSlider({ brands }: { brands: BrandSlide[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const total = Math.max(1, Math.round(el.scrollWidth / el.clientWidth));
    setPages(total);
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setPage(atEnd ? total - 1 : Math.round(el.scrollLeft / el.clientWidth));
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
  const goTo = (p: number) => {
    const el = scroller.current;
    el?.scrollTo({ left: p * el.clientWidth, behavior: "smooth" });
  };

  const cards = brands.filter((b) => b.banner);
  if (cards.length === 0) return null;

  const navButton =
    "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink shadow-md ring-1 ring-black/5 transition hover:bg-line-soft disabled:cursor-default disabled:opacity-40 md:h-11 md:w-11 xl:bg-line-soft xl:shadow-sm";

  return (
    <div>
      <div className="relative">
        <div
          ref={scroller}
          onScroll={measure}
          className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth md:gap-4"
        >
          {cards.map((b) => (
            <Link
              key={b.slug}
              href={`/brands/${b.slug}`}
              aria-label={`Shop ${b.name}`}
              className="group relative aspect-[2/3] shrink-0 basis-[calc((100%-0.75rem)/2)] snap-start overflow-hidden rounded-2xl bg-line-soft md:basis-[calc((100%-2rem)/3)] lg:basis-[calc((100%-4rem)/5)]"
            >
              <Image
                src={b.banner!}
                alt={b.name}
                fill
                sizes="(max-width:768px) 50vw, (max-width:1024px) 33vw, 20vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Arrow badge sits top-right so it never covers the logo at the bottom of the artwork. */}
              <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M7 17L17 7M9 7h8v8" />
                </svg>
              </span>
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Previous brands"
          disabled={page === 0}
          className={cn(navButton, "left-2 xl:-left-[calc(clamp(1rem,4vw,4rem)_-_0.5rem)]")}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="Next brands"
          disabled={page >= pages - 1}
          className={cn(navButton, "right-2 xl:-right-[calc(clamp(1rem,4vw,4rem)_-_0.5rem)]")}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex justify-center gap-1.5">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Brands page ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === page ? "w-7 bg-ink-muted" : "w-1.5 bg-line",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
