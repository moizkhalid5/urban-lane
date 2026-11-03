/**
 * Shop events for Google Analytics 4 (its recommended ecommerce events) and Microsoft Clarity (the same names,
 * so recordings can be filtered by them). Safe to call anywhere in the browser: events wait until the tools
 * have started (components/analytics/Analytics.tsx), and when analytics is off, or a blocker stopped it,
 * nothing is sent.
 *
 * Prices are sent in rupees (the shop's base currency), whatever currency the shopper is viewing.
 */
import type { CartLine } from "@/lib/cart";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
    /** set by the analytics start-up script once gtag and Clarity are set up */
    __ulAnalyticsReady?: boolean;
    /** events from before that, sent by the start-up script */
    __ulAnalyticsPending?: [string, Record<string, unknown>][];
  }
}

export const ANALYTICS_CURRENCY = "PKR";

/** A product in an event, as GA4 expects it. */
export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  item_list_name?: string;
  price?: number;
  discount?: number;
  quantity?: number;
  index?: number;
};

/** Rupees from the shop's stored paisa. */
export const rupees = (cents: number) => Math.round(cents) / 100;

/** A line in the bag as an analytics item; `quantity`: how many the event is about (default: the line's). */
export function cartLineItem(line: CartLine, quantity = line.quantity): AnalyticsItem {
  return {
    item_id: line.productId,
    item_name: line.title,
    ...(line.brand && { item_brand: line.brand }),
    ...(line.variantLabel && { item_variant: line.variantLabel }),
    price: rupees(line.unitPriceCents),
    quantity,
  };
}

export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  if (!window.__ulAnalyticsReady) {
    (window.__ulAnalyticsPending ??= []).push([event, params]);
    return;
  }
  window.gtag?.("event", event, params);
  window.clarity?.("event", event);
}

/** An ecommerce event: the items, and their total as `value`. */
export function trackItems(event: string, items: AnalyticsItem[], extra: Record<string, unknown> = {}) {
  const value = items.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 1), 0);
  track(event, { currency: ANALYTICS_CURRENCY, value: Math.round(value * 100) / 100, items, ...extra });
}

/** Fires once per key in this browser (e.g. one purchase per order, however often the page is reopened). */
export function trackOnce(key: string, send: () => void) {
  try {
    const k = `ul_tracked:${key}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
  } catch {
    // Storage blocked: send anyway; GA4 also ignores a repeated purchase with the same transaction_id.
  }
  send();
}
