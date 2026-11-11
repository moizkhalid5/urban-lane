import type { Metadata } from "next";
import Link from "next/link";
import { listProducts, getFacets } from "@/lib/queries/products";
import {
  parseFilters,
  baseToDisplay,
  DEPARTMENT_POSSESSIVE,
  type RawSearchParams,
} from "@/lib/queries/parse-filters";
import { getActiveCurrency } from "@/lib/currency.server";
import { Filters } from "@/components/collection/Filters";
import { SortSelect } from "@/components/collection/SortSelect";
import { ProductFeed } from "@/components/collection/ProductFeed";
import { feedFilter, FEED_BATCH } from "@/lib/queries/product-feed";
import { SALE, activeSale } from "@/lib/sale";
import { SaleBanner } from "@/components/sale/SaleBanner";
import { SaleCountdown } from "@/components/sale/SaleCountdown";

export const metadata: Metadata = {
  title: SALE.title,
  description: `The Urban Lane ${SALE.title}: discounted clothing, shoes and accessories, until ${SALE.lastDay}.`,
};

const DEPARTMENTS = [
  { key: "", label: "All" },
  { key: "women", label: "Women" },
  { key: "men", label: "Men" },
  { key: "kids", label: "Kids" },
];

/**
 * The 11.11 sale (lib/sale.ts): every product discounted in Admin, i.e. with a compare-at price above its
 * price. Linked from the red "11.11" in the menu, the homepage banner and the sale poster.
 */
export default async function SalePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const sale = await activeSale();

  if (!sale) {
    return (
      <div className="container-site flex flex-col items-center py-24 text-center">
        <h1 className="text-3xl font-medium">{SALE.title}</h1>
        <p className="mt-3 max-w-md text-ink-muted">
          {new Date() < SALE.starts
            ? `The ${SALE.title} starts on 11 November. See you then!`
            : new Date() >= SALE.ends
              ? `The ${SALE.title} has ended. Thank you for shopping with us.`
              : // during the sale, before any product has its sale price
                `The ${SALE.title} prices are being added. Please check back shortly.`}
        </p>
        <Link href="/offers" className="btn-secondary mt-6">
          See today&apos;s offers
        </Link>
      </div>
    );
  }

  const currency = await getActiveCurrency();
  const filter = parseFilters(sp, currency);
  const feedSource = { kind: "sale" as const };
  const [{ products, total }, facetData] = await Promise.all([
    listProducts({
      ...feedFilter(feedSource, sp, currency),
      page: 1,
      pageSize: FEED_BATCH,
    }),
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
      Object.entries(sp).flatMap(([k, v]) =>
        k === key || k === "page" || v === undefined
          ? []
          : [[k, Array.isArray(v) ? v[0] : v]],
      ),
    );
    if (value) next.set(key, value);
    const qs = next.toString();
    return `${SALE.href}${qs ? `?${qs}` : ""}`;
  };

  const department = filter.gender ? DEPARTMENT_POSSESSIVE[filter.gender] : null;

  return (
    <>
      {/* Edge to edge under the menu. On phones it fills the screen, so it steps aside once a filter is chosen. */}
      <SaleBanner
        href="#products"
        label={`See the ${SALE.title} products`}
        hideOnPhones={Object.keys(sp).some((k) => k !== "page")}
      />
      <div className="container-site pb-8">
        {/* Title on the left; the countdown on the right (below the title on phones) */}
        <div
          id="products"
          className="mt-8 flex scroll-mt-28 flex-col gap-6 md:flex-row md:items-start md:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sale">
              Until {SALE.lastDay}
            </p>
            <h1 className="mt-1 text-3xl font-medium md:text-4xl">
              {department ? `${department} ${SALE.title}` : SALE.title}
            </h1>
            <p className="mt-2 max-w-2xl text-ink-muted">
              Up to {sale.maxPct}% off. The original price is crossed out on every item,
              with the sale price next to it.
            </p>
          </div>
          <SaleCountdown ends={SALE.ends.getTime()} now={Date.now()} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {DEPARTMENTS.map((d) => {
            const active = d.key
              ? filter.gender?.toLowerCase() === d.key
              : !filter.gender;
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
                <Link href={SALE.href} className="btn-secondary mt-6">
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
    </>
  );
}
