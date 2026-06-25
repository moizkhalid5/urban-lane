"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type HeroSlide = { title: string; subtitle?: string | null; image: string | null; link?: string | null };

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [count]);

  if (count === 0) return null;

  return (
    <section className="relative h-[60vh] min-h-[420px] w-full overflow-hidden bg-line-soft">
      {slides.map((slide, i) => (
        <div
          key={i}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-premium",
            i === index ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
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
        </div>
      ))}

      {count > 1 && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-white" : "w-1.5 bg-white/50")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
