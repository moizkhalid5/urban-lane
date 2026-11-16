import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listProducts, getFacets } from "@/lib/queries/products";
import { parseFilters, baseToDisplay, type RawSearchParams } from "@/lib/queries/parse-filters";
import { getActiveCurrency } from "@/lib/currency.server";
import { Filters } from "@/components/collection/Filters";
import { SortSelect } from "@/components/collection/SortSelect";
import { ProductFeed } from "@/components/collection/ProductFeed";
import { feedFilter, FEED_BATCH } from "@/lib/queries/product-feed";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getSiteSettings } from "@/lib/settings";
import { brandMetadata } from "@/lib/seo/meta";
import { brandStats } from "@/lib/seo/stats";
import { BRAND_GUIDES } from "@/lib/seo/content";
import { breadcrumbLd } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/seo/JsonLd";
import { ListingGuide, guideIntro } from "@/components/seo/ListingGuide";

const DEPT_LINKS = { women: "women", men: "men", kids: "kids", beauty: "beauty", jewellery: "jewellery" } as const;
const DEPT_FOR = { women: "for women", men: "for men", kids: "for kids", beauty: "beauty", jewellery: "jewellery" } as const;

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) return { title: "Brand" };
  // "Original Next Clothes in Pakistan | Men, Kids, Women"; noindex while the brand has no live products.
  const [stats, settings] = await Promise.all([brandStats(brand.id), getSiteSettings()]);
  return brandMetadata(brand, stats, settings);
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) notFound();

  const currency = await getActiveCurrency();
  const filter = parseFilters(sp, currency);

  const feedSource = { kind: "brand" as const, slug };
  const [{ products, total }, facetData, stats, settings] = await Promise.all([
    listProducts({ ...feedFilter(feedSource, sp, currency), page: 1, pageSize: FEED_BATCH }),
    // Facets across this brand's products (compute from a broad query, then narrow client-side).
    getFacets(undefined),
    brandStats(brand.id),
    getSiteSettings(),
  ]);
  const guide = BRAND_GUIDES[brand.slug];
  const intro = brand.description || guideIntro(guide, stats, settings);
  const unfiltered = Object.keys(sp).length === 0;

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
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", href: "/" },
          { name: "Brands", href: "/brands" },
          { name: brand.name, href: `/brands/${brand.slug}` },
        ])}
      />

      <header className="mt-4">
        <h1 className="text-3xl font-medium md:text-4xl">{brand.name} in Pakistan</h1>
        {intro && <p className="mt-2 max-w-2xl text-ink-muted">{intro}</p>}
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

      {/* About the brand, where to find it, and questions: on the plain page only. */}
      {unfiltered && (
        <ListingGuide
          label={brand.name}
          guide={guide}
          stats={stats}
          shop={settings}
          sectionLinks={stats.departments.map((d) => ({
            name: `${brand.name} ${DEPT_FOR[d]}`,
            href: `/collections/${DEPT_LINKS[d]}?brands=${brand.slug}`,
          }))}
        />
      )}
    </div>
  );
}
