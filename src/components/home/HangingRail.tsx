"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Anton } from "next/font/google";
import type { DisplayCurrency } from "@/lib/money";
import type { RailCard, RailTab } from "@/lib/rail/queries";
import { Price } from "@/components/ui/Price";
import { cn } from "@/lib/utils";

const display = Anton({ weight: "400", subsets: ["latin"], display: "swap" });

/** Rail photos are portrait 4:5 (garment on a hanger, hook at the top centre). */
const RATIO = 0.8;
/** Width of a sideways garment's spot on the rail, as a share of the front-facing one. */
const SIDE = 0.4;
/** Height of the hook bend in the photos, as a share of the photo height: the bar runs through it. */
const HOOK = 0.022;
/** Space above the bar for the ceiling rods. */
const TOP = 56;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Homepage "hanging rail" (Admin → Homepage rail): buttons for the collections ("Men's Suits", "Women's Winter
 * Jackets"…) above a rail of that collection's garments. Switching collection hangs the new garments with the
 * same slide-in as when the rail first appears.
 */
export function HangingRail({ collections, currency, heading }: { collections: RailTab[]; currency: DisplayCurrency; heading?: string }) {
  const [tab, setTab] = useState(0);
  const current = collections[Math.min(tab, collections.length - 1)];
  return (
    <section aria-label={heading || "On the rail"} className="overflow-hidden bg-white pb-10 pt-8">
      <div className="container-site">
        {heading && <h2 className="mb-4 text-center text-2xl font-medium md:text-3xl">{heading}</h2>}
        {collections.length > 1 && (
          <div
            role="tablist"
            aria-label="Collections"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:justify-center md:px-0"
          >
            {collections.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={i === tab}
                aria-controls="rail-panel"
                onClick={() => setTab(i)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-wide transition-colors",
                  i === tab ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-ink",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div id="rail-panel" role="tabpanel" aria-label={current.name}>
        <RailStage key={current.id} items={current.items} currency={currency} />
      </div>
    </section>
  );
}

/**
 * One collection on the rail: garments hang side-on; the chosen one turns to face the shopper (its side photo
 * swaps for its front photo with a quarter turn), the hangers swing, the big word behind changes ("COAT",
 * "HOODIE"), and its name, price and sizes show below.
 * Desktop: hover to turn, click to shop. Phone: swipe or tap to turn, tap again to shop. Arrow keys work too.
 */
function RailStage({ items, currency }: { items: RailCard[]; currency: DisplayCurrency }) {
  const n = items.length;
  const [active, setActive] = useState(Math.floor((n - 1) / 2));
  const [width, setWidth] = useState(0);
  const [entered, setEntered] = useState(false);
  const [shown, setShown] = useState(active); // what the word and details show (changes after a short fade)
  const [fading, setFading] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const swingRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const lockUntil = useRef(0);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const swiped = useRef(false);
  const calm = useRef(false); // prefers-reduced-motion

  // Measure the stage (and re-measure on resize)
  useIsoLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    calm.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const swing = useCallback((i: number, amount: number) => {
    const el = swingRefs.current[i];
    if (!el || calm.current) return;
    el.style.setProperty("--sway", String(amount));
    el.classList.remove("rail-swinging");
    void el.offsetWidth; // restart the animation
    el.classList.add("rail-swinging");
  }, []);

  // Slide in and swing when the rail first scrolls into view
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !width) return;
    if (calm.current || typeof IntersectionObserver === "undefined") return setEntered(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setEntered(true);
        items.forEach((_, i) => setTimeout(() => swing(i, i === active ? 2.2 : 1.2), 650 + i * 70));
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width > 0]);

  const turnTo = useCallback(
    (next: number) => {
      const to = Math.min(Math.max(next, 0), n - 1);
      if (to === active) return;
      lockUntil.current = Date.now() + 350;
      swing(to, to > active ? -2.8 : 2.8);
      // Garments that slide along swing a little too
      items.forEach((_, i) => {
        if (i !== to && (i === active || (i > Math.min(active, to) && i < Math.max(active, to)))) swing(i, to > active ? -1.4 : 1.4);
      });
      setActive(to);
    },
    [active, items, n, swing],
  );

  // Word, name, price and sizes fade out, change, and fade back in
  useEffect(() => {
    if (shown === active) return;
    if (calm.current) return setShown(active);
    setFading(true);
    const t = setTimeout(() => {
      setShown(active);
      setFading(false);
    }, 220);
    return () => clearTimeout(t);
  }, [active, shown]);

  // ── Layout ───────────────────────────────────────────────────────────────
  const phone = width > 0 && width < 640;
  const H = !width ? 480 : phone ? Math.min(width * 1.05, 440) : Math.min(Math.max(width * 0.4, 380), 560);
  const A = H * RATIO;
  const S = A * SIDE;
  const total = A + (n - 1) * S;
  const activeCentre = active * S + A / 2;
  const offset = total <= width ? (width - total) / 2 : Math.min(0, Math.max(width - total, width / 2 - activeCentre));
  const slotLeft = (i: number) => offset + (i <= active ? i * S : active * S + A + (i - active - 1) * S);
  const barY = TOP + H * HOOK;
  // The bar spans the stage, or further when a long collection hangs past it (it then runs off the screen)
  const hookX = (i: number) => slotLeft(i) + (i === active ? A : S) / 2;
  const barLeft = Math.min(width * 0.02, hookX(0) - 30);
  const barRight = Math.max(width * 0.98, hookX(n - 1) + 30);

  const item = items[shown];
  const word = item.word.toUpperCase();
  const wordSize = Math.min(H * 0.92, (width * 0.86) / Math.max(word.length * 0.5, 1));

  // ── Swipe (touch) ───────────────────────────────────────────────────────
  const touch = useRef<{ x: number; y: number; on: boolean } | null>(null);

  return (
    <div className="container-site">
      <div
        ref={stageRef}
        className={cn("relative select-none", !width && "invisible")}
        style={{ height: TOP + H + 24, touchAction: "pan-y" }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          touch.current = { x: e.clientX, y: e.clientY, on: true };
          swiped.current = false;
        }}
        onPointerMove={(e) => {
          const t = touch.current;
          if (!t?.on) return;
          const dx = e.clientX - t.x;
          const dy = e.clientY - t.y;
          if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) touch.current = null; // scrolling the page
          else if (Math.abs(dx) > 40) {
            swiped.current = true;
            touch.current = null;
            turnTo(active + (dx < 0 ? 1 : -1));
          }
        }}
        onPointerUp={() => {
          touch.current = null;
          setTimeout(() => (swiped.current = false), 60);
        }}
      >
        {/* Big word behind the rail */}
        <p
          aria-hidden
          className={cn(
            display.className,
            "pointer-events-none absolute left-1/2 whitespace-nowrap uppercase leading-[0.8] text-[#ececec] transition-all duration-200",
            fading ? "opacity-0" : "opacity-100",
          )}
          style={{
            top: TOP + H * 0.58,
            fontSize: wordSize,
            transform: `translate(-50%, ${fading ? "-46%" : "-50%"})`,
          }}
        >
          {word}
        </p>

        {/* Ceiling rods and bar */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 z-[5]"
          style={{
            left: barLeft,
            width: barRight - barLeft,
            height: barY + 4,
            transition: calm.current ? "none" : "left 1.05s cubic-bezier(0.16, 1, 0.3, 1), width 1.05s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <span className="absolute left-0 top-0 w-[3px] bg-gradient-to-r from-[#c9c9c9] to-[#9c9c9c]" style={{ height: barY + 2 }} />
          <span className="absolute right-0 top-0 w-[3px] bg-gradient-to-r from-[#c9c9c9] to-[#9c9c9c]" style={{ height: barY + 2 }} />
          <span
            className="absolute inset-x-0 h-[4px] rounded-full bg-gradient-to-b from-[#dedede] via-[#b4b4b4] to-[#8f8f8f] shadow-[0_2px_3px_rgba(0,0,0,0.12)]"
            style={{ top: barY - 2 }}
          />
        </div>

        {/* Garments */}
        <ul className="absolute inset-x-0 top-0" style={{ height: TOP + H }}>
          {items.map((g, i) => {
            const front = i === active;
            const flip = i < active ? -90 : 90;
            return (
              <li
                key={g.id}
                className="absolute top-0 z-[6]"
                style={{
                  width: front ? A : S,
                  height: TOP + H,
                  transform: `translate3d(${slotLeft(i) + (entered ? 0 : width * 0.4)}px, 0, 0)`,
                  opacity: entered ? 1 : 0,
                  zIndex: front ? 7 : 6,
                  transition: calm.current
                    ? "none"
                    : `transform 1.05s cubic-bezier(0.16, 1, 0.3, 1) ${entered ? 0 : i * 80}ms, width 1.05s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.7s ease ${i * 80}ms`,
                }}
              >
                <Link
                  ref={(el) => {
                    linkRefs.current[i] = el;
                  }}
                  href={g.href}
                  aria-label={front ? `${g.name}: view product` : `Show ${g.name}`}
                  aria-current={front ? "true" : undefined}
                  className="absolute inset-x-0 block focus-visible:outline-none"
                  style={{ top: TOP, height: H }}
                  onMouseEnter={() => {
                    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
                    clearTimeout(hoverTimer.current);
                    hoverTimer.current = setTimeout(() => Date.now() > lockUntil.current && turnTo(i), 110);
                  }}
                  onMouseLeave={() => clearTimeout(hoverTimer.current)}
                  // Keyboard only: a tap also focuses the link, and must turn the garment, not open it
                  onFocus={(e) => e.currentTarget.matches(":focus-visible") && turnTo(i)}
                  onClick={(e) => {
                    if (swiped.current || i !== active) {
                      e.preventDefault();
                      if (!swiped.current) turnTo(i);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                    e.preventDefault();
                    linkRefs.current[Math.min(Math.max(i + (e.key === "ArrowRight" ? 1 : -1), 0), n - 1)]?.focus();
                  }}
                >
                  <span
                    ref={(el) => {
                      swingRefs.current[i] = el;
                    }}
                    onAnimationEnd={(e) => e.currentTarget.classList.remove("rail-swinging")}
                    className="pointer-events-none absolute left-1/2 top-0 [filter:drop-shadow(0_22px_18px_rgba(29,29,29,0.16))]"
                    style={{ width: A, height: H, marginLeft: -A / 2, transformOrigin: `50% ${HOOK * 100}%` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.front}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      className="rail-face absolute inset-0 h-full w-full object-contain [backface-visibility:hidden]"
                      style={{
                        opacity: front ? 1 : 0,
                        transform: `perspective(1600px) rotateY(${front ? 0 : flip}deg)`,
                        transition: front
                          ? "transform .62s cubic-bezier(.33,.9,.38,1) .3s, opacity .16s linear .26s"
                          : "transform .36s cubic-bezier(.55,.05,.75,.45), opacity .16s linear .24s",
                      }}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.side}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      className="rail-face absolute inset-0 h-full w-full object-contain [backface-visibility:hidden]"
                      style={{
                        opacity: front ? 0 : 1,
                        transform: `perspective(1600px) rotateY(${front ? -flip : 0}deg)`,
                        transition: front
                          ? "transform .36s cubic-bezier(.55,.05,.75,.45), opacity .16s linear .24s"
                          : "transform .62s cubic-bezier(.33,.9,.38,1) .3s, opacity .16s linear .26s",
                      }}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Details of the garment facing the shopper, and the controls */}
      <div className="mt-2 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className={cn("min-h-[7.5rem] transition-opacity duration-200", fading ? "opacity-0" : "opacity-100")} aria-live="polite">
          {item.brand && <p className="text-[11px] uppercase tracking-wide text-ink-muted">{item.brand}</p>}
          <Link href={item.href} className="mt-0.5 block text-xl font-medium hover:underline md:text-2xl">
            {item.name}
          </Link>
          <Price cents={item.priceCents} compareAtCents={item.compareAtCents} uk={item.uk} currency={currency} size="lg" className="mt-1" />
          {item.sizes.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Sizes">
              {item.sizes.map((s) => (
                <li
                  key={s.label}
                  className={cn(
                    "min-w-[2rem] rounded border px-2 py-0.5 text-center text-xs",
                    s.inStock ? "border-line text-ink" : "border-line-soft text-ink-muted line-through",
                  )}
                  aria-label={s.inStock ? s.label : `${s.label}, sold out`}
                >
                  {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col items-start gap-2 md:items-center">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => turnTo(active - 1)}
              disabled={active === 0}
              aria-label="Previous garment"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line transition-colors hover:border-ink disabled:opacity-40"
            >
              <span aria-hidden>‹</span>
            </button>
            <div className="flex w-28 items-center" aria-hidden>
              {items.map((g, i) => (
                <span key={g.id} className={cn("h-px flex-1 transition-all", i === active ? "h-[2px] bg-ink" : "bg-line")} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => turnTo(active + 1)}
              disabled={active === n - 1}
              aria-label="Next garment"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line transition-colors hover:border-ink disabled:opacity-40"
            >
              <span aria-hidden>›</span>
            </button>
          </div>
          <p className="text-xs text-ink-muted">
            <span className="hidden [@media(hover:hover)]:inline">Hover to turn, click to shop</span>
            <span className="[@media(hover:hover)]:hidden">Swipe to turn, tap to shop</span>
          </p>
        </div>
      </div>
    </div>
  );
}
