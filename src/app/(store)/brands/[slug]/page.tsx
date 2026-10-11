import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listProducts, getFacets } from "@/lib/queries/products";
import { parseFilters, baseToDisplay, type RawSearchParams } from "@/lib/queries/parse-filters";
import { getActiveCurrency } from "@/lib/currency.server";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Filters } from "@/components/collection/Filters";
import { SortSelect } from "@/components/collection/SortSelect";
import { Pagination } from "@/components/collection/Pagination";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) return { title: "Brand" };
  return {
    title: brand.seoTitle || `${brand.name} — Shop online`,
    description: brand.seoDescription || `Shop ${brand.name} at Urban Lane.`,
    alternates: { canonical: `/brands/${brand.slug}` },
  };
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) notFound();

  const currency = await getActiveCurrency();
  const filter = parseFilters(sp, currency);

  const [{ products, total, page, totalPages }, facetData] = await Promise.all([
    listProducts({ ...filter, brandSlugs: [slug], pageSize: 12 }),
    // Facets across this brand's products (compute from a broad query, then narrow client-side).
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
      <Breadcrumbs items={[{ name: "Brands", href: "/brands" }, { name: brand.name, href: `/brands/${brand.slug}` }]} />

      <header className="mt-4">
        <h1 className="text-3xl font-medium md:text-4xl">{brand.name}</h1>
        {brand.description && <p className="mt-2 max-w-2xl text-ink-muted">{brand.description}</p>}
      </header>

      <div className="mt-8 flex items-center justify-between border-b border-line pb-4">
        <p className="text-sm text-ink-muted">{total} product(s)</p>
        <SortSelect value={filter.sort ?? "latest"} />
      </div>

      <div className="mt-8 lg:flex lg:gap-10">
        <Filters facets={facets} currencySymbol={currency.symbol} hideBrand />
        <div className="min-w-0 flex-1">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-line py-24 text-center">
              <p className="text-lg font-medium">No products yet</p>
              <p className="mt-1 text-sm text-ink-muted">Check back soon for {brand.name}.</p>
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
