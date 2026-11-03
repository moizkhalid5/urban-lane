"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track, trackItems, trackOnce, type AnalyticsItem } from "@/lib/analytics/track";

/**
 * Sends one analytics event when the page opens (lib/analytics/track.ts), e.g. view_item on a product page.
 * It isn't sent again when the page refreshes its data (e.g. a quantity changed in the bag), only on another
 * page, or when `fireKey` changes (e.g. a new search on the search page).
 * `items`: sent as an ecommerce event with their total as `value`. `once`: a key so it's sent only once in
 * this browser, e.g. the purchase for an order.
 */
export function TrackEvent({
  event,
  items,
  params,
  once,
  fireKey,
}: {
  event: string;
  items?: AnalyticsItem[];
  params?: Record<string, unknown>;
  once?: string;
  fireKey?: string;
}) {
  const path = usePathname();
  useEffect(() => {
    const send = () => (items ? trackItems(event, items, params) : track(event, params));
    if (once) trackOnce(once, send);
    else send();
    // Once per page (and fireKey), with the contents it opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, path, fireKey, once]);
  return null;
}
