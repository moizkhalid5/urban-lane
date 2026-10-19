"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ArtworkBannerLinks } from "@/components/ui/ArtworkBannerLinks";

export type HeroSlide = { title: string; subtitle?: string | null; image: string | null; link?: string | null };

// A slide with no title is an artwork banner (its text is part of the image): it is shown in the
// content column at `aspect` (images are pre-cropped to it), without the text overlay. If its painted
// button is listed in lib/banner-buttons, that button becomes the link; otherwise the whole slide is.
// Its subtitle is used as the image's alt text.
const isArtwork = (s: HeroSlide) => !s.title && !!s.image;

export function HeroCarousel({
  slides,
  aspect = "aspect-[2/1]",
  arrows = false,
  inContainer = false,
}: {
  slides: HeroSlide[];
  /** Tailwind aspect class for artwork banners. */
  aspect?: string;
  /** Prev/next buttons beside the banner (shown when there is more than one slide). */
  arrows?: boolean;
  /** Already inside a .container-site (e.g. a collection page), so don't add another. */
  inContainer?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [count]);

  if (count === 0) return null;
  const artwork = slides.every(isArtwork);

  const carousel = (
    <section
      className={cn(
        "relative w-full overflow-hidden",
        artwork ? aspect : "h-[60vh] min-h-[420px] bg-line-soft",
      )}
    >
      {slides.map((slide, i) => (
        <div
          key={i}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-premium",
            i === index ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {isArtwork(slide) ? (
            <>
              <Image
                src={slide.image!}
                alt={slide.subtitle ?? ""}
                fill
                priority={i === 0}
                sizes="(max-width:1440px) 100vw, 1312px"
                className="object-cover"
              />
              <ArtworkBannerLinks image={slide.image} href={slide.link ?? "/"} label={slide.subtitle ?? "Shop the collection"} />
            </>
          ) : (
            <>
              {slide.image && (
                <Image
                  src={slide.image}
                  alt={slide.title}
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
              <div className="container-site relative flex h-full flex-col items-start justify-end pb-16 text-white">
                <h1 className="max-w-xl text-4xl font-medium md:text-5xl">{slide.title}</h1>
                {slide.subtitle && <p className="mt-2 max-w-md text-base text-white/85">{slide.subtitle}</p>}
                {slide.link && (
                  <Link href={slide.link} className="mt-6 btn bg-white text-ink hover:bg-white/90">
                    Shop now
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      ))}

      {count > 1 && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.25)] transition-all", // outline keeps dots visible on light banners
                i === index ? "w-6 bg-white" : "w-1.5 bg-white/50",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );

  const arrowButton =
    "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink shadow-md ring-1 ring-black/5 transition hover:bg-line-soft md:h-11 md:w-11 xl:bg-line-soft xl:shadow-sm";
  const withArrows =
    arrows && count > 1 ? (
      <div className="relative">
        {carousel}
        <button type="button" aria-label="Previous banner" onClick={() => setIndex((i) => (i - 1 + count) % count)} className={cn(arrowButton, "left-2 xl:-left-16")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button type="button" aria-label="Next banner" onClick={() => setIndex((i) => (i + 1) % count)} className={cn(arrowButton, "right-2 xl:-right-16")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    ) : (
      carousel
    );

  // Artwork banners sit in the content column (same edges as the logo and category tiles) on the white page.
  return artwork && !inContainer ? <div className="container-site">{withArrows}</div> : withArrows;
}
