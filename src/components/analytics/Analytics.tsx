"use client";

import Link from "next/link";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { track, type AnalyticsItem } from "@/lib/analytics/track";

/**
 * Google Analytics 4 and Microsoft Clarity on the shop (not the admin), with Google Consent Mode v2. Only
 * analytics cookies are used; advertising storage always stays off.
 * - Visitors in the EEA, UK and Switzerland are only measured after they accept analytics cookies (Google
 *   works out the region; the banner shows for visitors whose clock is set to a European time zone).
 *   Everyone else is measured unless they've chosen "Reject"; "Cookie settings" in the footer reopens it.
 * - Page views: GA4 counts them itself, including pages opened without a full reload.
 * - Product lists: every product card that comes into view is reported (view_item_list), and clicking one
 *   (select_item). Cards say what they show in data-analytics-item (components/product/ProductCard.tsx).
 * Other shop events are sent where they happen (lib/analytics/track.ts).
 */

const CONSENT_KEY = "ul_consent";
export const COOKIE_SETTINGS_EVENT = "ul:cookie-settings";

// Where analytics waits for consent: the EEA, the UK and Switzerland.
const CONSENT_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT",
  "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
];

type Choice = "granted" | "denied";

function startUpScript(gaId: string | null, clarityId: string | null) {
  const regions = JSON.stringify(CONSENT_REGIONS);
  const lines = [
    `var choice = null; try { choice = localStorage.getItem(${JSON.stringify(CONSENT_KEY)}); } catch (e) {}`,
    `var v = choice === "granted" ? "granted" : "denied";`,
  ];
  if (clarityId) {
    lines.push(
      `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(clarityId)});`,
      `if (choice) clarity("consentv2", { ad_Storage: "denied", analytics_Storage: v });`,
    );
  }
  if (gaId) {
    lines.push(
      `window.dataLayer = window.dataLayer || []; window.gtag = function(){ dataLayer.push(arguments); };`,
      `var noAds = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };`,
      `gtag("consent", "default", Object.assign({ analytics_storage: "denied", region: ${regions}, wait_for_update: 500 }, noAds));`,
      `gtag("consent", "default", Object.assign({ analytics_storage: "granted" }, noAds));`,
      `if (choice) gtag("consent", "update", { analytics_storage: v });`,
      `gtag("js", new Date()); gtag("config", ${JSON.stringify(gaId)});`,
    );
  }
  lines.push(
    `window.__ulAnalyticsReady = true;`,
    `(window.__ulAnalyticsPending || []).forEach(function (e) { window.gtag && gtag("event", e[0], e[1]); window.clarity && clarity("event", e[0]); });`,
    `window.__ulAnalyticsPending = [];`,
  );
  return lines.join("\n");
}

/** Visitors whose clock is on European time see the cookie banner until they choose. */
function onEuropeanClock() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    return zone.startsWith("Europe/") || ["Atlantic/Reykjavik", "Atlantic/Canary", "Atlantic/Madeira", "Atlantic/Faroe", "Atlantic/Azores"].includes(zone);
  } catch {
    return false;
  }
}

function savedChoice(): Choice | null {
  try {
    const c = localStorage.getItem(CONSENT_KEY);
    return c === "granted" || c === "denied" ? c : null;
  } catch {
    return null;
  }
}

/** What kind of page this is, for filtering Clarity recordings. */
function pageType(path: string) {
  if (path === "/") return "home";
  if (path.startsWith("/products/")) return "product";
  if (path.startsWith("/collections/") || path.startsWith("/brands") || path.startsWith("/offers")) return "collection";
  if (path.startsWith("/search")) return "search";
  if (path.startsWith("/cart")) return "cart";
  if (path.startsWith("/checkout/success")) return "order_confirmation";
  if (path.startsWith("/checkout")) return "checkout";
  if (path.startsWith("/account") || path.startsWith("/wishlist")) return "account";
  return "other";
}

/** The list a product card was seen in: its own data-analytics-list, or the page's. */
function listName(el: Element, path: string) {
  const own = el.closest<HTMLElement>("[data-analytics-list]")?.dataset.analyticsList;
  if (own) return own;
  if (path === "/") return "Homepage";
  if (path.startsWith("/products/")) return "You may also like";
  return path.replace(/^\//, "").replace(/\//g, " / ") || "Homepage";
}

function readItem(el: Element): AnalyticsItem | null {
  try {
    return JSON.parse((el as HTMLElement).dataset.analyticsItem ?? "");
  } catch {
    return null;
  }
}

export function Analytics({ gaMeasurementId, clarityProjectId }: { gaMeasurementId: string | null; clarityProjectId: string | null }) {
  const path = usePathname();
  const [banner, setBanner] = useState(false);

  useEffect(() => {
    if (!savedChoice() && onEuropeanClock()) setBanner(true);
    const reopen = () => setBanner(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  const choose = useCallback((c: Choice) => {
    try {
      localStorage.setItem(CONSENT_KEY, c);
    } catch {}
    window.gtag?.("consent", "update", { analytics_storage: c });
    window.clarity?.("consentv2", { ad_Storage: "denied", analytics_Storage: c });
    setBanner(false);
  }, []);

  useEffect(() => {
    window.clarity?.("set", "page_type", pageType(path));
  }, [path]);

  // Product cards: seen (half in view) and clicked.
  useEffect(() => {
    const seen = new WeakSet<Element>();
    const watched = new WeakSet<Element>();
    const queue = new Map<string, AnalyticsItem[]>();
    const counts = new Map<string, number>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      for (const [list, items] of queue) {
        for (let i = 0; i < items.length; i += 20) {
          track("view_item_list", { item_list_name: list, items: items.slice(i, i + 20) });
        }
      }
      queue.clear();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || seen.has(e.target)) continue;
          seen.add(e.target);
          observer.unobserve(e.target);
          const item = readItem(e.target);
          if (!item) continue;
          const list = listName(e.target, path);
          const index = counts.get(list) ?? 0;
          counts.set(list, index + 1);
          queue.set(list, [...(queue.get(list) ?? []), { ...item, item_list_name: list, index }]);
        }
        clearTimeout(timer);
        timer = setTimeout(flush, 1000);
      },
      { threshold: 0.5 },
    );
    const scan = () => {
      document.querySelectorAll("[data-analytics-item]").forEach((el) => {
        if (watched.has(el)) return;
        watched.add(el);
        observer.observe(el);
      });
    };
    scan();
    // Lists that load more as the shopper scrolls, and rows that appear later.
    let pendingScan: ReturnType<typeof setTimeout> | undefined;
    const mutations = new MutationObserver(() => {
      clearTimeout(pendingScan);
      pendingScan = setTimeout(scan, 300);
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    const onClick = (e: MouseEvent) => {
      const card = (e.target as Element | null)?.closest?.("[data-analytics-item]");
      const item = card && readItem(card);
      if (!card || !item) return;
      const list = listName(card, path);
      track("select_item", { item_list_name: list, items: [{ ...item, item_list_name: list }] });
    };
    document.addEventListener("click", onClick, true);

    return () => {
      flush();
      clearTimeout(timer);
      clearTimeout(pendingScan);
      observer.disconnect();
      mutations.disconnect();
      document.removeEventListener("click", onClick, true);
    };
  }, [path]);

  return (
    <>
      <Script id="ul-analytics" strategy="afterInteractive">
        {startUpScript(gaMeasurementId, clarityProjectId)}
      </Script>
      {gaMeasurementId && (
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
      )}
      {banner && (
        <div
          role="dialog"
          aria-label="Cookies"
          className="fixed inset-x-4 bottom-24 z-[60] border border-line bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] md:bottom-6 md:left-6 md:right-auto md:max-w-sm"
        >
          <p className="text-sm text-ink">
            We use cookies to see how our shop is used and to make it better. You can change your choice at any
            time under &ldquo;Cookie settings&rdquo; at the bottom of the page.{" "}
            <Link href="/privacy-policy" className="underline">
              Privacy policy
            </Link>
          </p>
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => choose("granted")} className="btn-primary flex-1">
              Accept
            </button>
            <button type="button" onClick={() => choose("denied")} className="btn-secondary flex-1">
              Reject
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Footer link that reopens the cookie banner. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))} className={className}>
      Cookie settings
    </button>
  );
}
