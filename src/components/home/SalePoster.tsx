"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RAIL_ELEMENT_ID } from "@/components/home/HangingRail";

type Props = {
  name: string;
  href: string;
  poster: { src: string; width: number; height: number };
  /** remembered in the browser, so each visitor sees the poster once per sale */
  storageKey: string;
};

const seen = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const markSeen = (key: string) => {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* private window: it may show again, which is fine */
  }
};

/**
 * The sale poster (lib/sale.ts) that pops up once per visitor on the homepage, when they scroll down to the
 * rail (or, on a homepage without the rail, a screen and a bit down). Its button leads to the sale page.
 * Closes with ✕, Esc or a click beside it. The picture loads only as the visitor nears the rail.
 */
export function SalePoster({ name, href, poster, storageKey }: Props) {
  const [load, setLoad] = useState(false);
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (seen(storageKey)) return;
    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      window.removeEventListener("scroll", onScroll);
      if (seen(storageKey)) return;
      markSeen(storageKey);
      lastFocus.current = document.activeElement;
      setLoad(true);
      setOpen(true);
    };

    // Only once the visitor scrolls: on a big screen the rail can already peek in when the page opens.
    const onScroll = () => {
      const rail = document.getElementById(RAIL_ELEMENT_ID);
      if (rail) {
        const top = rail.getBoundingClientRect().top;
        // load the picture a little before the rail; open once the rail is well into the screen
        if (top < window.innerHeight + 1200) setLoad(true);
        if (window.scrollY > 150 && top < window.innerHeight * 0.6) show();
      } else {
        if (window.scrollY > window.innerHeight * 0.6) setLoad(true);
        if (window.scrollY > window.innerHeight * 1.2) show();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    (lastFocus.current as HTMLElement | null)?.focus?.({ preventScroll: true });
  };

  if (!load) return null;

  return (
    <>
      {/* preloads the picture before the poster opens */}
      {!open && <link rel="preload" as="image" href={poster.src} />}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 motion-safe:animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${name} sale`}
            className="relative w-[min(92vw,540px,calc(88svh*1024/1536))] overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.45)] motion-safe:animate-poster-in"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- poster artwork, served as is (lossless) */}
            <img
              src={poster.src}
              alt={`Urban Lane ${name}: the winter sale, online now`}
              width={poster.width}
              height={poster.height}
              className="block h-auto w-full"
            />
            <button
              ref={closeButton}
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <Link
              href={href}
              onClick={() => setOpen(false)}
              className="absolute left-1/2 top-[87.5%] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap bg-white px-[1.6em] py-[0.85em] text-[clamp(12px,3.4vw,15px)] font-semibold uppercase tracking-[0.18em] text-ink shadow-[0_8px_22px_rgba(0,0,0,0.3)] transition hover:bg-ink hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Shop the {name} sale <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
