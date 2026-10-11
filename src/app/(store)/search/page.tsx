import type { Metadata } from "next";
import Link from "next/link";
import { listProducts, getFacets } from "@/lib/queries/products";
import { parseFilters, baseToDisplay, type RawSearchParams } from "@/lib/queries/parse-filters";
import { getActiveCurrency } from "@/lib/currency.server";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Filters } from "@/components/collection/Filters";
import { SortSelect } from "@/components/collection/SortSelect";
import { Pagination } from "@/components/collection/Pagination";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  const currency = await getActiveCurrency();
  const filter = parseFilters(sp, currency);

  const [{ products, total, page, totalPages }, facetData] = await Promise.all([
    listProducts({ ...filter, q, pageSize: 12 }),
    getFacets(undefined),
  ]);

  const facets = {
    brands: facetData.brands,
    sizes: facetData.sizes,
    colors: facetData.colors,
    priceMin: baseToDisplay(facetData.minCents, currency),
    priceMax: baseToDisplay(facetData.maxCents, currency),
  };

  return (
    <div className="container-site py-8">
      <h1 className="text-3xl font-medium">
        {q ? <>Search results for &ldquo;{q}&rdquo;</> : "Search"}
      </h1>

      {!q ? (
        <p className="mt-4 text-ink-muted">Enter a search term to find products.</p>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between border-b border-line pb-4">
            <p className="text-sm text-ink-muted">{total} result(s)</p>
            <SortSelect value={filter.sort ?? "latest"} />
          </div>
          <div className="mt-8 lg:flex lg:gap-10">
            <Filters facets={facets} currencySymbol={currency.symbol} />
            <div className="min-w-0 flex-1">
              {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center border border-dashed border-line py-24 text-center">
                  <p className="text-lg font-medium">No products match your search</p>
                  <p className="mt-1 text-sm text-ink-muted">Try a different term or browse our collections.</p>
                  <Link href="/collections/women" className="btn-secondary mt-6">Browse collections</Link>
                </div>
              ) : (
                <>
                  <ProductGrid products={products} currency={currency} className="lg:grid-cols-3 xl:grid-cols-4" />
                  <Pagination page={page} totalPages={totalPages} />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
