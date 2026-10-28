"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductCard as ProductCardData } from "@/lib/queries/products";
import type { DisplayCurrency } from "@/lib/money";
import type { RawSearchParams } from "@/lib/queries/parse-filters";
import { FEED_BATCH, type FeedSource } from "@/lib/queries/product-feed";
import { loadMoreProducts } from "@/app/actions/product-feed";
import { ProductGrid } from "@/components/product/ProductGrid";

/** Remembers how far down the list a customer was when they opened a product, for when they come back. */
const memoryKey = () => `feed:${location.pathname}${location.search}`;

/**
 * A listing's products as one long list: the page renders the first batch, and the next ones load as the
 * customer scrolls near the end, so there are no page numbers to click. Give it a `key` that changes
 * with the filters so it starts again from the top.
 */
export function ProductFeed({
  source,
  searchParams,
  initial,
  total,
  currency,
  className,
}: {
  source: FeedSource;
  searchParams: RawSearchParams;
  initial: ProductCardData[];
  total: number;
  currency: DisplayCurrency;
  className?: string;
}) {
  const [products, setProducts] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const hasMore = products.length < total;

  const fetchMore = useCallback(
    async (count: number) => {
      if (busy.current) return [];
      busy.current = true;
      setLoading(true);
      setFailed(false);
      try {
        const offset = products.length;
        const more = await loadMoreProducts(source, searchParams, offset, count);
        setProducts((list) => {
          const seen = new Set(list.map((p) => p.id));
          return [...list, ...more.filter((p) => !seen.has(p.id))];
        });
        return more;
      } catch {
        setFailed(true);
        return [];
      } finally {
        busy.current = false;
        setLoading(false);
      }
    },
    [products.length, source, searchParams],
  );

  // Coming back from a product: show as many products as before and return to the same place.
  useEffect(() => {
    let saved: { count: number; y: number } | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(memoryKey()) ?? "null");
      sessionStorage.removeItem(memoryKey());
    } catch {}
    if (!saved) return;
    const { count, y } = saved;
    const restore = () => requestAnimationFrame(() => window.scrollTo(0, y));
    if (count > initial.length) fetchMore(count - initial.length).then(restore);
    else restore();
    // Only on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the next batch when the end of the list comes within about a screen of view.
  useEffect(() => {
    const el = end.current;
    if (!el || !hasMore || failed) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && fetchMore(FEED_BATCH), {
      rootMargin: "0px 0px 1200px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, failed, fetchMore]);

  const remember = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest("a[href^='/products/']")) return;
    try {
      sessionStorage.setItem(memoryKey(), JSON.stringify({ count: products.length, y: window.scrollY }));
    } catch {}
  };

  return (
    <div onClickCapture={remember}>
      <ProductGrid products={products} currency={currency} className={className} />
      <div ref={end} className="mt-10 flex min-h-10 items-center justify-center text-sm text-ink-muted" aria-live="polite">
        {failed ? (
          <button type="button" onClick={() => fetchMore(FEED_BATCH)} className="btn-secondary">
            Couldn&apos;t load more products. Try again
          </button>
        ) : hasMore ? (
          loading && (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden />
              Loading more products…
            </span>
          )
        ) : (
          total > FEED_BATCH && <span>You&apos;ve seen all {total} products</span>
        )}
      </div>
    </div>
  );
}
