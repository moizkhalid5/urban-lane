"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HERO_ELEMENT_ID, type HomeSlide } from "@/lib/collection-heroes";
import { ArtworkBannerLinks } from "@/components/ui/ArtworkBannerLinks";
import { cn } from "@/lib/utils";

/**
 * Homepage hero: full-width slider of artwork banners, all at the main banner's shape (2.334:1).
 * It sits under the header's transparent menu row; the strip behind the menu takes the colour of the
 * current slide's top edge, so the menu never covers faces or text. The slide's `tone` is published on
 * the section (data-tone) so the header picks dark or white menu text.
 *
 * Images are served as they are (high-quality WebP made by scripts/build_home_banners.py, no further
 * compression): full size on computers, 960px wide on phones.
 */
export function HomeHeroSlider({ slides }: { slides: HomeSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;
  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (count <= 1 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [count, paused]);

  if (count === 0) return null;
  const current = slides[index];

  return (
    <section
      id={HERO_ELEMENT_ID}
      data-tone={current.tone}
      aria-roledescription="carousel"
      aria-label="Featured"
      className="relative -mt-[65px] w-full overflow-hidden pt-[65px] transition-colors duration-1000"
      style={{ backgroundColor: current.band }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className="relative aspect-[1916/821]">
        {slides.map((s, i) => (
          <div
            key={s.key}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-premium",
              i === index ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <picture>
              <source media="(max-width: 767px)" srcSet={s.mobile} />
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised artwork, served as is */}
              <img
                src={s.desktop}
                alt={s.alt}
                width={s.width}
                height={s.height}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </picture>
            <ArtworkBannerLinks image={s.desktop} href={s.link} label={s.label} />
          </div>
        ))}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous banner"
              className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink shadow-sm transition hover:bg-white md:flex"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next banner"
              className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink shadow-sm transition hover:bg-white md:flex"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-2 md:bottom-4">
              {slides.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show banner ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    "h-2 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.15)] transition-all",
                    i === index ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/90",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
