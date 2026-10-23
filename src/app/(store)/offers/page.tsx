import type { Metadata } from "next";
import Link from "next/link";
import { listProducts, getFacets } from "@/lib/queries/products";
import {
  parseFilters,
  baseToDisplay,
  saveLabel,
  DEPARTMENT_POSSESSIVE,
  type RawSearchParams,
} from "@/lib/queries/parse-filters";
import { getActiveCurrency } from "@/lib/currency.server";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Filters } from "@/components/collection/Filters";
import { SortSelect } from "@/components/collection/SortSelect";
import { Pagination } from "@/components/collection/Pagination";

export const metadata: Metadata = {
  title: "Offers",
  description: "Products cheaper at Urban Lane than at UK retailers, and everything on sale.",
};

const DEPARTMENTS = [
  { key: "", label: "All" },
  { key: "women", label: "Women" },
  { key: "men", label: "Men" },
  { key: "kids", label: "Kids" },
];

/**
 * Every product that shows a discount: a real sale, or cheaper than its UK price. The homepage's sale
 * banners link here, e.g. /offers?gender=women or /offers?save=25-35&gender=men,women,kids.
 */
export default async function OffersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const currency = await getActiveCurrency();
  const filter = parseFilters(sp, currency);
  const save = filter.save ?? { min: 1, max: 100 };

  const [{ products, total, page, totalPages }, facetData] = await Promise.all([
    listProducts({ ...filter, save, pageSize: 12 }),
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
    return `/offers${qs ? `?${qs}` : ""}`;
  };

  const department = filter.gender ? DEPARTMENT_POSSESSIVE[filter.gender] : null;

  return (
    <div className="container-site py-8">
      <h1 className="text-3xl font-medium md:text-4xl">{department ? `${department} offers` : "Offers"}</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Items on sale, and items priced below their UK retail price (RRP, converted to rupees).
      </p>

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
        {filter.save && (filter.save.min > 1 || filter.save.max < 100) && (
          <Link
            href={withParam("save", "")}
            className="inline-flex items-center gap-2 bg-sale px-4 py-1.5 text-sm text-white"
            aria-label="Show every discount, not only this range"
          >
            {saveLabel(filter.save)} <span aria-hidden>✕</span>
          </Link>
        )}
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
              <p className="text-lg font-medium">No offers match these filters</p>
              <p className="mt-1 text-sm text-ink-muted">Try removing a filter or browse our collections.</p>
              <Link href="/offers" className="btn-secondary mt-6">
                See all offers
              </Link>
            </div>
          ) : (
            <>
              <ProductGrid products={products} currency={currency} className="lg:grid-cols-3 xl:grid-cols-4" />
              <Pagination page={page} totalPages={totalPages} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
