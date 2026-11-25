"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A banner film laid over its poster picture (which the server already shows, so the page paints at once).
 *
 * - Only the film for the screen downloads: `desktop` from 768px, `phone` below.
 * - It starts at `startAt`, the moment the poster was taken from, so the poster turns into the film
 *   without a jump, then loops.
 * - Silent, no controls, plays inline. It pauses while scrolled out of view, and has a pause button
 *   (anything moving longer than 5 seconds must be pausable).
 * - Not loaded at all for visitors who ask for less motion or for data saving: they keep the poster.
 */
export function BannerVideo({ desktop, phone, startAt = 0 }: { desktop: string; phone: string; startAt?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduce || saveData) return;
    const wide = window.matchMedia("(min-width: 768px)");
    const pick = () => setSrc(wide.matches ? desktop : phone);
    pick();
    wide.addEventListener("change", pick);
    return () => wide.removeEventListener("change", pick);
  }, [desktop, phone]);

  // play only while on screen (and not paused by the visitor)
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !paused) v.play().catch(() => {});
      else v.pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, [src, paused]);

  if (!src) return null;
  return (
    <>
      <video
        ref={ref}
        key={src}
        src={src}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        aria-hidden
        tabIndex={-1}
        onLoadedMetadata={(e) => {
          if (startAt) e.currentTarget.currentTime = startAt;
        }}
        onPlaying={() => setShown(true)}
        className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-700", shown ? "opacity-100" : "opacity-0")}
      />
      <button
        type="button"
        onClick={() => {
          const v = ref.current;
          if (!v) return;
          if (paused) v.play().catch(() => {});
          else v.pause();
          setPaused(!paused);
        }}
        aria-label={paused ? "Play the banner film" : "Pause the banner film"}
        className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white/80 backdrop-blur-sm transition hover:text-white md:bottom-4 md:right-4"
      >
        {paused ? (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <path d="M4 2.5v11l9-5.5z" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" />
          </svg>
        )}
      </button>
    </>
  );
}
