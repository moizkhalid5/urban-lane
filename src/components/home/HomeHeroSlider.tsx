"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { preload } from "react-dom";
import { HERO_ELEMENT_ID, type HomeSlide } from "@/lib/collection-heroes";
import { ArtworkBannerLinks } from "@/components/ui/ArtworkBannerLinks";
import { SaleBannerText } from "@/components/home/SaleBannerText";
import { cn } from "@/lib/utils";

const PHONE_WIDTH = 941;
const PHONE_HEIGHT = 1672;

/** Phones and computers each get their own picture; this blank stands in for the other one, so it isn't downloaded. */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAACH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PHONE_MEDIA = "(max-width: 767px)";
const WIDE_MEDIA = "(min-width: 768px)";

/** The slide that carries the sale wording during a sale, and whose Shop Now then leads to the sale. */
const SALE_SLIDE = "urban-lane";

export type HeroSale = { maxPct: number; href: string; name: string };

/**
 * Homepage hero: full-width slider of artwork banners. Tablets and computers show the 2.334:1 banners,
 * phones a tall picture of each, filling the screen (.phone-frame, lib/collection-heroes.ts).
 *
 * It slides up under the header's menu row (-mt = the row's height plus its 1px border: 48px on phones
 * and tablets, 64px from lg), which is see-through while over the slider and turns white once it has
 * scrolled away. The slide's `tone` is published on the section (data-tone) so the header picks dark or
 * white text; behind white text a soft shade runs down from the top edge.
 *
 * Images are served as they are (WebP at quality 94, made by scripts/encode-banners.cjs; no further
 * compression). Each screen downloads only its own picture (phone or wide). The first slide is preloaded
 * and loads first; the neighbouring slides follow once the page has finished loading, and the slider
 * starts turning only then, so the first banner never waits for the others.
 * On phones the slide dots sit in the corner, clear of the painted buttons.
 */
export function HomeHeroSlider({ slides: baseSlides, sale }: { slides: HomeSlide[]; sale?: HeroSale | null }) {
  const slides = sale
    ? baseSlides.map((s) =>
        s.key === SALE_SLIDE ? { ...s, link: sale.href, label: `Shop the ${sale.name} sale, up to ${sale.maxPct}% off` } : s,
      )
    : baseSlides;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;
  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  // false until the page has loaded: until then only the first slide's picture is fetched
  const [warm, setWarm] = useState(false);
  const loaded = useRef(new Set<number>());
  for (const step of warm ? [-1, 0, 1] : [0]) loaded.current.add((index + step + count) % count);

  useEffect(() => {
    const go = () => setWarm(true);
    if (document.readyState === "complete") {
      const t = setTimeout(go, 300);
      return () => clearTimeout(t);
    }
    window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);

  useEffect(() => {
    if (!warm || count <= 1 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [warm, count, paused]);

  if (count === 0) return null;
  // Start the first banner's download straight away, from the page's <head> (one for each kind of screen)
  preload(slides[0].phone, { as: "image", fetchPriority: "high", media: PHONE_MEDIA });
  preload(slides[0].desktop, {
    as: "image",
    fetchPriority: "high",
    imageSrcSet: `${slides[0].desktopSmall} 960w, ${slides[0].desktop} ${slides[0].width}w`,
    imageSizes: "100vw",
    media: WIDE_MEDIA,
  });
  const current = slides[index];

  return (
    <section
      id={HERO_ELEMENT_ID}
      data-tone={current.tone}
      aria-roledescription="carousel"
      aria-label="Featured"
      className="relative -mt-[49px] w-full overflow-hidden lg:-mt-[65px]"
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
      <div className="phone-frame relative md:aspect-[1916/821]">
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
            {/* Phones: tall picture */}
            <div className="absolute inset-0 md:hidden">
              <div
                className="phone-cover"
                style={{ "--art-ratio": PHONE_WIDTH / PHONE_HEIGHT, "--focus-x": s.phoneFocus?.[0], "--focus-y": s.phoneFocus?.[1] } as CSSProperties}
              >
                {loaded.current.has(i) && (
                  <picture>
                    <source media={WIDE_MEDIA} srcSet={BLANK} />
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised artwork, served as is */}
                    <img
                      src={s.phone}
                      alt={s.alt}
                      width={PHONE_WIDTH}
                      height={PHONE_HEIGHT}
                      fetchPriority={i === 0 ? "high" : "low"}
                      decoding={i === 0 ? "sync" : "async"}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </picture>
                )}
                {sale && s.key === SALE_SLIDE && <SaleBannerText name={sale.name} maxPct={sale.maxPct} phone />}
                <ArtworkBannerLinks image={s.phone} href={s.link} label={s.label} />
              </div>
            </div>
            {/* Tablets and computers: 2.334:1 banner */}
            <div className="absolute inset-0 hidden md:block">
              {loaded.current.has(i) && (
                <picture>
                  <source media={PHONE_MEDIA} srcSet={BLANK} />
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised artwork, served as is */}
                  <img
                    src={s.desktop}
                    srcSet={`${s.desktopSmall} 960w, ${s.desktop} ${s.width}w`}
                    sizes="100vw"
                    alt={s.alt}
                    width={s.width}
                    height={s.height}
                    fetchPriority={i === 0 ? "high" : "low"}
                    decoding={i === 0 ? "sync" : "async"}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </picture>
              )}
              {sale && s.key === SALE_SLIDE && <SaleBannerText name={sale.name} maxPct={sale.maxPct} />}
              <ArtworkBannerLinks image={s.desktop} href={s.link} label={s.label} />
            </div>
          </div>
        ))}

        {/* soft shade behind the white menu text */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent transition-opacity duration-1000 lg:h-32",
            current.tone === "dark" ? "opacity-100" : "opacity-0",
          )}
        />

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
            <div className="absolute bottom-2 right-3 z-10 flex gap-2 md:bottom-4 md:left-1/2 md:right-auto md:-translate-x-1/2">
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
