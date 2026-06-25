"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { NavItem } from "@/lib/queries/nav";
import { CurrencySwitcher } from "./CurrencySwitcher";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 bg-white">
      {announcement && (
        <div className="bg-ink text-center text-xs tracking-wide text-white">
          <div className="container-site py-2">{announcement}</div>
        </div>
      )}

      <div
        className={cn(
          "border-b bg-white transition-shadow duration-200",
          scrolled ? "border-line shadow-[0_1px_0_rgba(0,0,0,0.04)]" : "border-transparent",
        )}
        onMouseLeave={() => setActiveMenu(null)}
      >
        {/* utility row */}
        <div className="hidden border-b border-line-soft lg:block">
          <div className="container-site flex h-9 items-center justify-end gap-6 text-xs text-ink-muted">
            {isStaff && (
              <Link href="/admin" className="hover:text-ink">
                Admin
              </Link>
            )}
            <Link href="/contact" className="hover:text-ink">
              Help
            </Link>
            <CurrencySwitcher currencies={currencies} active={activeCurrency} />
          </div>
        </div>

        {/* main row */}
        <div className="container-site flex h-16 items-center gap-4">
          {/* mobile menu button */}
          <button
            type="button"
            className="lg:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </button>

          <Link href="/" className="shrink-0 text-xl font-semibold uppercase tracking-[0.2em] lg:mr-6">
            Urbane&nbsp;Lane
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
                    item.slug === "outlet" ? "text-sale hover:text-sale/80" : "text-ink hover:text-ink-muted",
                  )}
                >
                  {item.name}
                </Link>

                {/* mega menu */}
                {activeMenu === item.slug && item.columns.length > 0 && (
                  <div className="absolute left-0 right-0 top-full animate-fade-in border-y border-line bg-white">
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
            <button type="button" aria-label="Search" onClick={() => setSearchOpen((s) => !s)}>
              <SearchIcon />
            </button>
            <Link href={isAuthed ? "/account" : "/login"} aria-label="Account" className="hidden sm:block">
              <UserIcon />
            </Link>
            <Link href="/account/wishlist" aria-label="Wishlist" className="hidden sm:block">
              <HeartIcon />
            </Link>
            <Link href="/cart" aria-label="Cart" className="relative">
              <BagIcon />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-medium text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* search bar */}
        {searchOpen && (
          <div className="border-t border-line bg-white">
            <div className="container-site py-3">
              <SearchForm onDone={() => setSearchOpen(false)} />
            </div>
          </div>
        )}
      </div>

      {/* mobile drawer */}
      {mobileOpen && (
        <MobileNav nav={nav} isAuthed={isAuthed} isStaff={isStaff} onClose={() => setMobileOpen(false)} />
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
  onClose,
}: {
  nav: NavItem[];
  isAuthed: boolean;
  isStaff: boolean;
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
const HeartIcon = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21z" />
  </svg>
);
const BagIcon = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 8h12l-1 12H7L6 8z" />
    <path d="M9 8V6a3 3 0 016 0v2" />
  </svg>
);
