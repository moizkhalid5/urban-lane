import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryWithAncestors } from "@/lib/queries/categories";
import { listProducts, getFacets } from "@/lib/queries/products";
import { parseFilters, baseToDisplay, type RawSearchParams } from "@/lib/queries/parse-filters";
import { getActiveCurrency } from "@/lib/currency.server";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Filters } from "@/components/collection/Filters";
import { SortSelect } from "@/components/collection/SortSelect";
import { Pagination } from "@/components/collection/Pagination";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { KidsLanding } from "@/components/collection/KidsLanding";
import { DepartmentLanding, hasDepartmentLanding } from "@/components/collection/DepartmentLanding";
import { AGE_BANDS } from "@/lib/kids-age";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryWithAncestors(slug);
  if (!data) return { title: "Collection" };
  const { category } = data;
  return {
    title: category.seoTitle || category.name,
    description: category.seoDescription || `Shop ${category.name} at Urban Lane.`,
    alternates: { canonical: `/collections/${category.slug}` },
    openGraph: { title: category.name, url: `/collections/${category.slug}` },
  };
}

export default async function CollectionPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const data = await getCategoryWithAncestors(slug);
  if (!data) notFound();
  const { category, ancestors, children } = data;

  const currency = await getActiveCurrency();
  const filter = parseFilters(sp, currency);

  const [{ products, total, page, totalPages }, facetData] = await Promise.all([
    listProducts({ ...filter, categorySlug: category.slug, pageSize: 12 }),
    getFacets(category.slug),
  ]);

  // Department landing sections (banner, shop-by tiles) show on the plain Kids / Men / Women
  // pages; any filter or sort goes straight to the products.
  const unfiltered = Object.keys(sp).length === 0;
  const showKidsLanding = category.slug === "kids" && unfiltered;
  const showDepartmentLanding = hasDepartmentLanding(category.slug) && unfiltered;
  const showLanding = showKidsLanding || showDepartmentLanding;
  const activeAges = AGE_BANDS.filter((a) => filter.ages?.includes(a.key));
  const withoutAges = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (k === "ages" || v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]])),
  ).toString();

  const facets = {
    brands: facetData.brands,
    sizes: facetData.sizes,
    colors: facetData.colors,
    priceMin: baseToDisplay(facetData.minCents, currency),
    priceMax: baseToDisplay(facetData.maxCents, currency),
  };

  return (
    <div className="container-site py-8">
      <Breadcrumbs items={[...ancestors, { name: category.name, href: `/collections/${category.slug}` }]} />

      {showKidsLanding && <KidsLanding />}
      {showDepartmentLanding && <DepartmentLanding slug={category.slug} />}

      <header className={showLanding ? "mt-16" : "mt-4"}>
        <h1 className="text-3xl font-medium md:text-4xl">
          {showLanding ? `Shop all ${category.name.toLowerCase()}` : category.name}
        </h1>
        {category.description && <p className="mt-2 max-w-2xl text-ink-muted">{category.description}</p>}
      </header>

      {/* Sub-category buttons on phones; on desktop they are in the filter panel's "Category" row. */}
      {children.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2 lg:hidden">
          {children.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className="border border-line px-4 py-1.5 text-sm transition-colors hover:border-ink"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {activeAges.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/collections/${category.slug}${withoutAges ? `?${withoutAges}` : ""}`}
            className="inline-flex items-center gap-2 bg-ink px-4 py-1.5 text-sm text-white"
            aria-label="Remove age filter"
          >
            Age: {activeAges.map((a) => a.label).join(", ")} <span aria-hidden>✕</span>
          </Link>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between border-b border-line pb-4">
        <p className="text-sm text-ink-muted">
          {total} {total === 1 ? "product" : "products"}
        </p>
        <SortSelect value={filter.sort ?? "latest"} />
      </div>

      <div className="mt-8 lg:flex lg:gap-10">
        <Filters facets={facets} currencySymbol={currency.symbol} hideBrand={false} categories={children} />

        <div className="min-w-0 flex-1">
          <div className="mb-4 lg:hidden" />
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-line py-24 text-center">
              <p className="text-lg font-medium">No products found</p>
              <p className="mt-1 text-sm text-ink-muted">Try adjusting or clearing your filters.</p>
              <Link href={`/collections/${category.slug}`} className="btn-secondary mt-6">
                Clear filters
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
