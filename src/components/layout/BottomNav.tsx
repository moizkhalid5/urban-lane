"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { heroForPath } from "@/lib/collection-heroes";
import { cn } from "@/lib/utils";

type Tab = { key: string; href: string; label: string; icon: (on: boolean) => React.ReactNode; badge?: number; match: (path: string) => boolean };

const SLOTS = 5; // four tabs + the scroll ring

/**
 * Phone-only bottom bar: Home, Wishlist, Orders, Account and a ring showing how far down the page you are
 * (tap it to go back to the top). Frosted white glass, so colours behind it show through softly. The current
 * tab gets a soft grey pill (which glides between tabs) and a filled icon. Hidden at checkout, and on pages
 * with a full-screen banner until the shopper scrolls, so it doesn't cover the banner's painted button.
 */
export function BottomNav({ isAuthed, wishlistCount }: { isAuthed: boolean; wishlistCount: number }) {
  const pathname = usePathname() ?? "/";
  const tabs: Tab[] = [
    { key: "home", href: "/", label: "Home", icon: (on) => <HomeIcon on={on} />, match: (p) => p === "/" },
    { key: "wishlist", href: "/wishlist", label: "Wishlist", icon: (on) => <HeartIcon on={on} />, badge: wishlistCount, match: (p) => p.startsWith("/wishlist") },
    { key: "orders", href: "/account/orders", label: "Orders", icon: (on) => <BoxIcon on={on} />, match: (p) => p.startsWith("/account/orders") },
    {
      key: "account",
      href: isAuthed ? "/account" : "/login",
      label: isAuthed ? "Account" : "Log in",
      icon: (on) => <UserIcon on={on} />,
      match: (p) => p === "/login" || p === "/register" || (p.startsWith("/account") && !p.startsWith("/account/orders")),
    },
  ];
  const active = tabs.findIndex((t) => t.match(pathname));
  const { progress, atTop } = useScrollProgress();
  const hidden = atTop && !!heroForPath(pathname);

  if (pathname.startsWith("/checkout")) return null;

  return (
    <nav
      aria-label="Quick links"
      className={cn(
        "fixed inset-x-3 z-40 mx-auto max-w-md transition-[transform,opacity] duration-300 ease-premium motion-reduce:transition-none md:hidden",
        hidden && "pointer-events-none translate-y-24 opacity-0",
      )}
      style={{ bottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className="relative h-16">
        {/* Frosted white glass bar */}
        <div className="absolute inset-0 rounded-full border border-white/70 bg-white/75 shadow-[0_8px_30px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-black/[0.04] backdrop-blur-xl backdrop-saturate-[1.6]" />

        {/* Soft pill behind the current tab */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-y-1.5 rounded-full bg-black/[0.07] transition-[left,opacity] duration-500 [transition-timing-function:cubic-bezier(0.25,1,0.4,1)] motion-reduce:transition-none",
            active < 0 && "opacity-0",
          )}
          style={{ left: `calc(${Math.max(active, 0) * (100 / SLOTS)}% + 6px)`, width: `calc(${100 / SLOTS}% - 12px)` }}
        />

        <ul className="relative grid h-full grid-cols-5">
          {tabs.map((t, i) => {
            const on = i === active;
            return (
              <li key={t.key} className="flex">
                <Link
                  href={t.href}
                  aria-label={t.badge ? `${t.label} (${t.badge})` : t.label}
                  aria-current={on ? "page" : undefined}
                  className={cn("relative flex flex-1 items-center justify-center transition-colors", on ? "text-ink" : "text-ink/80 active:text-ink")}
                >
                  <span className="relative">
                    {t.icon(on)}
                    {!!t.badge && (
                      <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sale px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                        {t.badge > 9 ? "9+" : t.badge}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="flex">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label={`Back to top (${Math.round(progress * 100)}% of the page scrolled)`}
              className="flex flex-1 items-center justify-center text-ink"
            >
              <ProgressRing value={progress} />
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}

/** How far down the page the shopper has scrolled (0–1), and whether they're still at the very top. */
function useScrollProgress() {
  const [value, setValue] = useState(0);
  const [atTop, setAtTop] = useState(true);
  const frame = useRef(0);
  useEffect(() => {
    const measure = () => {
      frame.current = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setValue(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
      setAtTop(window.scrollY < 8);
    };
    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame.current);
    };
  }, []);
  return { progress: value, atTop };
}

function ProgressRing({ value }: { value: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        transform="rotate(-90 18 18)"
      />
      <path d="M18 24V12M13 17l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Outline icons; the current tab's icon is filled and a little bolder.
const svg = (on: boolean) => ({
  className: "h-6 w-6",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: on ? 2 : 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});
const HomeIcon = ({ on }: { on: boolean }) => (
  <svg {...svg(on)} fill={on ? "currentColor" : "none"}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </svg>
);
// Same heart as the header and WishlistButton (Lucide "heart", ISC licence)
const HeartIcon = ({ on }: { on: boolean }) => (
  <svg {...svg(on)} fill={on ? "currentColor" : "none"}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);
const BoxIcon = ({ on }: { on: boolean }) => (
  <svg {...svg(on)} fill="none">
    <path d="M21 8 12 3 3 8v8l9 5 9-5z" fill={on ? "currentColor" : "none"} />
    <path d="m3 8 9 5 9-5M12 13v8" stroke={on ? "white" : "currentColor"} />
  </svg>
);
const UserIcon = ({ on }: { on: boolean }) => (
  <svg {...svg(on)} fill={on ? "currentColor" : "none"}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);
