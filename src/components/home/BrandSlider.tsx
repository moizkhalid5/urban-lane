"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";

export type BrandSlide = { name: string; slug: string; banner: string | null };

export function BrandSlider({ brands }: { brands: BrandSlide[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    scroller.current?.scrollBy({ left: dir * 360, behavior: "smooth" });
  };

  if (brands.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
      >
        {brands.map((b) => (
          <Link
            key={b.slug}
            href={`/brands/${b.slug}`}
            className="group relative aspect-[3/1] w-[300px] shrink-0 snap-start overflow-hidden bg-line-soft sm:w-[360px]"
          >
            {b.banner && (
              <Image
                src={b.banner}
                alt={b.name}
                fill
                sizes="360px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="text-lg font-medium uppercase tracking-[0.2em] text-white">{b.name}</span>
            </div>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Previous"
        className="absolute -left-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-line bg-white p-2 shadow-sm md:block"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Next"
        className="absolute -right-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-line bg-white p-2 shadow-sm md:block"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
