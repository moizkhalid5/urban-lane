"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { NavItem } from "@/lib/queries/nav";
import { CurrencySwitcher } from "./CurrencySwitcher";
import { cn } from "@/lib/utils";
import { PhoneLink, SocialLinks } from "./SocialContact";
import { AnnouncementTicker } from "./AnnouncementTicker";
import { HERO_ELEMENT_ID, heroForPath } from "@/lib/collection-heroes";

type Props = {
  nav: NavItem[];
  currencies: { code: string; symbol: string; flag: string }[];
  activeCurrency: string;
  announcement?: string | null;
  isAuthed: boolean;
  isStaff: boolean;
  cartCount: number;
};

export function Header({ nav, currencies, activeCurrency, announcement, isAuthed, isStaff, cartCount }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  // Pages that start with a full-width banner (homepage, Outlet): the menu row is transparent until the
  // banner has scrolled away beneath it, or while a mega menu or the search bar is open. Where the
  // banner's picture starts below the menu (data-hero-art, the homepage slider), the menu turns solid as
  // soon as more than 1% of the picture would go under it, so the picture never shows through the menu.
  const pathname = usePathname();
  const pageHero = heroForPath(pathname);
  const heroPage = !!pageHero;
  const [overHero, setOverHero] = useState(heroPage);
  // The homepage slider publishes the current slide's tone (data-tone) as it changes.
  const [heroTone, setHeroTone] = useState(pageHero?.tone);
  const menuRow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      const hero = heroPage ? document.getElementById(HERO_ELEMENT_ID) : null;
      const rowBottom = menuRow.current?.getBoundingClientRect().bottom ?? 0;
      const art = hero?.querySelector<HTMLElement>("[data-hero-art]")?.getBoundingClientRect();
      setOverHero(
        !!hero &&
          hero.getBoundingClientRect().bottom > rowBottom + 1 &&
          (!art || art.top >= rowBottom - art.height * 0.01),
      );
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [heroPage, pathname]);

  useEffect(() => {
    setHeroTone(pageHero?.tone);
    const hero = heroPage ? document.getElementById(HERO_ELEMENT_ID) : null;
    if (!hero) return;
    const read = () => setHeroTone((hero.dataset.tone as "dark" | "light" | undefined) ?? pageHero?.tone);
    read();
    const observer = new MutationObserver(read);
    observer.observe(hero, { attributes: true, attributeFilter: ["data-tone"] });
    return () => observer.disconnect();
  }, [heroPage, pathname, pageHero?.tone]);

  const transparent = heroPage && overHero && !activeMenu && !searchOpen;
  // White menu text over dark artwork; light artwork keeps the usual dark text.
  const whiteText = transparent && heroTone === "dark";

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40">
      {/* Black strip: phone (left), announcement (centre), Instagram + TikTok (right); stacked on phones. */}
      <div className="bg-ink text-xs tracking-wide text-white">
        <div className="container-site flex flex-wrap items-center justify-center gap-x-5 gap-y-1 py-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
          <PhoneLink className="order-2 sm:order-none sm:justify-self-start" />
          <AnnouncementTicker
            // Admin → Settings: one message per line.
            messages={(announcement ?? "").split(/\r?\n/).map((m) => m.trim()).filter(Boolean)}
            className="order-1 w-full sm:order-none sm:w-auto"
          />
          <SocialLinks className="order-3 sm:order-none sm:justify-self-end" />
        </div>
      </div>

      <div
        ref={menuRow}
        className={cn(
          "border-b transition-[background-color,color,box-shadow] duration-300",
          whiteText
            ? "border-transparent bg-transparent text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]"
            : transparent
              ? "border-transparent bg-transparent text-ink"
              : ["bg-white text-ink", scrolled ? "border-line shadow-[0_1px_0_rgba(0,0,0,0.04)]" : "border-transparent"],
        )}
        onMouseLeave={() => setActiveMenu(null)}
      >
        {/* main row. Currency and the staff Admin link sit with the icons; Help is in the footer. */}
        {/* 48px tall on phones and tablets, 64px from lg (banners under the menu match: PageHeroBanner,
            HomeHeroSlider). The logo is centred until lg. */}
        <div className="container-site relative flex h-12 items-center gap-4 lg:h-16">
          {/* mobile menu button */}
          <button
            type="button"
            className="lg:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </button>

          <Link
            href="/"
            className="absolute left-1/2 shrink-0 -translate-x-1/2 text-lg font-semibold uppercase tracking-[0.18em] lg:static lg:mr-6 lg:translate-x-0 lg:text-xl lg:tracking-[0.2em]"
          >
            Urban&nbsp;Lane
          </Link>

          {/* desktop nav */}
          <nav className="hidden flex-1 items-stretch gap-1 lg:flex">
            {nav.map((item) => (
              <div
                key={item.slug}
                className="flex items-center"
                onMouseEnter={() => setActiveMenu(item.columns.length ? item.slug : null)}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors",
                    item.slug === "outlet"
                      ? whiteText
                        ? "text-[#ff8f8f] hover:text-[#ffb3b3]"
                        : "text-sale hover:text-sale/80"
                      : whiteText
                        ? "text-white hover:text-white/75"
                        : "text-ink hover:text-ink-muted",
                  )}
                >
                  {item.name}
                </Link>

                {/* mega menu */}
                {activeMenu === item.slug && item.columns.length > 0 && (
                  <div className="absolute left-0 right-0 top-full animate-fade-in border-y border-line bg-white text-ink [text-shadow:none]">
                    <div className="container-site grid grid-cols-2 gap-x-8 gap-y-6 py-8 md:grid-cols-4 lg:grid-cols-5">
                      {item.columns.map((col) => (
                        <div key={col.slug}>
                          <Link
                            href={col.href}
                            className="mb-3 block text-sm font-medium uppercase tracking-wide text-ink hover:underline"
                          >
                            {col.name}
                          </Link>
                          <ul className="space-y-2">
                            {col.children.map((leaf) => (
                              <li key={leaf.slug}>
                                <Link
                                  href={leaf.href}
                                  className="text-sm text-ink-muted transition-colors hover:text-ink"
                                >
                                  {leaf.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* actions */}
          <div className="ml-auto flex items-center gap-3 lg:gap-4">
            {isStaff && (
              <Link
                href="/admin"
                className={cn(
                  "hidden text-xs uppercase tracking-wide lg:block",
                  whiteText ? "text-white/80 hover:text-white" : "text-ink-muted hover:text-ink",
                )}
              >
                Admin
              </Link>
            )}
            <div className="hidden lg:block">
              <CurrencySwitcher currencies={currencies} active={activeCurrency} light={whiteText} />
            </div>
            <button type="button" aria-label="Search" onClick={() => setSearchOpen((s) => !s)}>
              <SearchIcon />
            </button>
            <Link href={isAuthed ? "/account" : "/login"} aria-label="Account" className="hidden sm:block">
              <UserIcon />
            </Link>
            <Link href="/wishlist" aria-label="Wishlist" className="hidden sm:block">
              <HeartIcon />
            </Link>
            <Link href="/cart" aria-label="Cart" className="relative">
              <BagIcon />
              {cartCount > 0 && (
                <span
                  className={cn(
                    "absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium [text-shadow:none]",
                    whiteText ? "bg-white text-ink" : "bg-ink text-white",
                  )}
                >
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* search bar */}
        {searchOpen && (
          <div className="border-t border-line bg-white text-ink [text-shadow:none]">
            <div className="container-site py-3">
              <SearchForm onDone={() => setSearchOpen(false)} />
            </div>
          </div>
        )}
      </div>

      {/* mobile drawer */}
      {mobileOpen && (
        <MobileNav
          nav={nav}
          isAuthed={isAuthed}
          isStaff={isStaff}
          currencies={currencies}
          activeCurrency={activeCurrency}
          onClose={() => setMobileOpen(false)}
        />
      )}
    </header>
  );
}

function SearchForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) {
          router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          onDone?.();
        }
      }}
      className="flex items-center gap-2"
    >
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search for products, brands…"
        className="input"
      />
      <button type="submit" className="btn-primary">
        Search
      </button>
    </form>
  );
}

function MobileNav({
  nav,
  isAuthed,
  isStaff,
  currencies,
  activeCurrency,
  onClose,
}: {
  nav: NavItem[];
  isAuthed: boolean;
  isStaff: boolean;
  currencies: Props["currencies"];
  activeCurrency: string;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm animate-drawer-in flex-col bg-white">
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <span className="text-lg font-semibold uppercase tracking-[0.2em]">Menu</span>
          <button type="button" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-2">
          {nav.map((item) => (
            <div key={item.slug} className="border-b border-line-soft">
              <div className="flex items-center justify-between">
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "py-3 text-sm font-medium uppercase tracking-wide",
                    item.slug === "outlet" ? "text-sale" : "text-ink",
                  )}
                >
                  {item.name}
                </Link>
                {item.columns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOpen((o) => (o === item.slug ? null : item.slug))}
                    aria-label="Expand"
                    className="p-2"
                  >
                    <span className={cn("block transition-transform", open === item.slug && "rotate-180")}>
                      <svg width="12" height="12" viewBox="0 0 10 10">
                        <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.2" fill="none" />
                      </svg>
                    </span>
                  </button>
                )}
              </div>
              {open === item.slug && (
                <ul className="space-y-1 pb-3 pl-3">
                  {item.columns.map((col) => (
                    <li key={col.slug}>
                      <Link
                        href={col.href}
                        onClick={onClose}
                        className="block py-1.5 text-sm text-ink-soft"
                      >
                        {col.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </nav>
        <div className="border-t border-line px-4 py-4 text-sm">
          <Link href={isAuthed ? "/account" : "/login"} onClick={onClose} className="block py-2">
            {isAuthed ? "My Account" : "Login / Register"}
          </Link>
          {isStaff && (
            <Link href="/admin" onClick={onClose} className="block py-2">
              Admin
            </Link>
          )}
          <div className="flex items-center justify-between py-2">
            <span className="text-ink-muted">Currency</span>
            <CurrencySwitcher currencies={currencies} active={activeCurrency} openUp />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── icons ── */
const ico = "h-[22px] w-[22px]";
const MenuIcon = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);
const CloseIcon = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const SearchIcon = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4" />
  </svg>
);
const UserIcon = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);
// Symmetric heart (Lucide "heart", ISC licence); the same shape is used by WishlistButton.
const HeartIcon = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);
const BagIcon = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 8h12l-1 12H7L6 8z" />
    <path d="M9 8V6a3 3 0 016 0v2" />
  </svg>
);
