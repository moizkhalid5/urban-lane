import Link from "next/link";
import { listProducts, getFacets } from "@/lib/queries/products";
import { parseFilters, baseToDisplay, DEPARTMENT_POSSESSIVE, type RawSearchParams } from "@/lib/queries/parse-filters";
import { getActiveCurrency } from "@/lib/currency.server";
import { Filters } from "@/components/collection/Filters";
import { SortSelect } from "@/components/collection/SortSelect";
import { ProductFeed } from "@/components/collection/ProductFeed";
import { feedFilter, FEED_BATCH } from "@/lib/queries/product-feed";
import { SaleCountdown } from "@/components/sale/SaleCountdown";
import type { SaleEvent } from "@/lib/sale";

const DEPARTMENTS = [
  { key: "", label: "All" },
  { key: "women", label: "Women" },
  { key: "men", label: "Men" },
  { key: "kids", label: "Kids" },
];

/**
 * A sale's products (lib/sale.ts): every product discounted in Admin, i.e. with a compare-at price above its
 * price, with the title, "up to N% off", the countdown, department chips, filters and the scrolling list.
 * Used by the 11.11 page (/sale) and the Black Friday page (/black-friday).
 */
export async function SaleListing({ event, maxPct, sp }: { event: SaleEvent; maxPct: number; sp: RawSearchParams }) {
  const currency = await getActiveCurrency();
  const filter = parseFilters(sp, currency);
  const feedSource = { kind: "sale" as const, above: event.above };
  const [{ products, total }, facetData] = await Promise.all([
    listProducts({ ...feedFilter(feedSource, sp, currency), page: 1, pageSize: FEED_BATCH }),
    getFacets(undefined),
  ]);

  const facets = {
    brands: facetData.brands,
    sizes: facetData.sizes,
    colors: facetData.colors,
    priceMin: baseToDisplay(facetData.minCents, currency),
    priceMax: baseToDisplay(facetData.maxCents, currency),
  };

  /** This page's link with one query param changed (or removed when value is empty). */
  const withParam = (key: string, value: string) => {
    const next = new URLSearchParams(
      Object.entries(sp).flatMap(([k, v]) => (k === key || k === "page" || v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]])),
    );
    if (value) next.set(key, value);
    const qs = next.toString();
    return `${event.href}${qs ? `?${qs}` : ""}`;
  };

  const department = filter.gender ? DEPARTMENT_POSSESSIVE[filter.gender] : null;

  return (
    <div className="container-site pb-8">
      {/* Title on the left; the countdown on the right (below the title on phones) */}
      <div id="products" className="mt-8 flex scroll-mt-28 flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sale">Until {event.lastDay}</p>
          <h1 className="mt-1 text-3xl font-medium md:text-4xl">{department ? `${department} ${event.title}` : event.title}</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            {event.above ? `Everything here is more than ${event.above}% off, up to ${maxPct}%.` : `Up to ${maxPct}% off.`} The original
            price is crossed out on every item, with the sale price next to it.
          </p>
        </div>
        <SaleCountdown ends={event.ends.getTime()} now={Date.now()} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {DEPARTMENTS.map((d) => {
          const active = d.key ? filter.gender?.toLowerCase() === d.key : !filter.gender;
          return (
            <Link
              key={d.label}
              href={withParam("gender", d.key)}
              aria-current={active ? "page" : undefined}
              className={`border px-4 py-1.5 text-sm transition-colors ${active ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`}
            >
              {d.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between border-b border-line pb-4">
        <p className="text-sm text-ink-muted">
          {total} {total === 1 ? "product" : "products"}
        </p>
        <SortSelect value={filter.sort ?? "latest"} />
      </div>
      <div className="mt-8 lg:flex lg:gap-10">
        <Filters facets={facets} currencySymbol={currency.symbol} />
        <div className="min-w-0 flex-1">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-line py-24 text-center">
              <p className="text-lg font-medium">No sale items match these filters</p>
              <p className="mt-1 text-sm text-ink-muted">Try removing a filter.</p>
              <Link href={event.href} className="btn-secondary mt-6">
                See the whole sale
              </Link>
            </div>
          ) : (
            <ProductFeed
              key={JSON.stringify(sp)}
              source={feedSource}
              searchParams={sp}
              initial={products}
              total={total}
              currency={currency}
              className="lg:grid-cols-3 xl:grid-cols-4"
            />
          )}
        </div>
      </div>
    </div>
  );
}
