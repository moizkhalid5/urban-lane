import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { listProducts } from "@/lib/queries/products";
import { getActiveCurrency } from "@/lib/currency.server";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductCard } from "@/components/product/ProductCard";
import { ScrollRail } from "@/components/ui/ScrollRail";
import { BrandSlider } from "@/components/home/BrandSlider";
import { BrandVideo } from "@/components/home/BrandVideo";
import { CustomerReviewsCarousel } from "@/components/reviews/CustomerReviewsCarousel";
import { getHomepageReviews } from "@/lib/reviews/queries";
import { HomeHeroSlider } from "@/components/home/HomeHeroSlider";
import { HOME_SLIDES, HOME_WINTER } from "@/lib/collection-heroes";
import { WideBanner } from "@/components/home/WideBanner";
import { HangingRail } from "@/components/home/HangingRail";
import { getHomepageRail } from "@/lib/rail/queries";

function SectionHeading({ title, href, cta }: { title: string; href?: string; cta?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <h2 className="text-2xl font-medium md:text-3xl">{title}</h2>
      {href && (
        <Link href={href} className="link-underline text-sm uppercase tracking-wide text-ink-soft">
          {cta ?? "View all"}
        </Link>
      )}
    </div>
  );
}

// "Featured" is split into one horizontally scrolling row per department.
const FEATURED_ROWS = [
  { slug: "men", title: "Men" },
  { slug: "women", title: "Women" },
  { slug: "kids", title: "Kids" },
];

export default async function HomePage() {
  const currency = await getActiveCurrency();

  const [featuredRows, newArrivals, outlet, tiles, brands, homepageReviews, rail] = await Promise.all([
    Promise.all(FEATURED_ROWS.map((r) => listProducts({ categorySlug: r.slug, sort: "featured", pageSize: 8 }))),
    listProducts({ sort: "latest", pageSize: 8 }),
    listProducts({ saleOnly: true, pageSize: 4 }),
    prisma.category.findMany({
      // Menu departments only; seasonal collections (e.g. Winter) are reached from banners.
      where: { level: 0, isVirtual: false, isActive: true, showInNav: true },
      orderBy: { position: "asc" },
      take: 5,
    }),
    prisma.brand.findMany({ where: { isFeatured: true }, orderBy: { position: "asc" } }),
    getHomepageReviews(15),
    getHomepageRail(),
  ]);

  // Hanging rail (Admin → Homepage rail), at the place chosen there
  const railAt = (placement: string) =>
    rail?.settings.placement === placement ? <HangingRail collections={rail.collections} currency={currency} heading={rail.settings.heading} /> : null;

  return (
    <>
      {/* Full-width banner slider under the transparent menu (slides: lib/collection-heroes.ts) */}
      <HomeHeroSlider slides={HOME_SLIDES} />

      {railAt("after-hero")}

      {/* Category tiles */}
      <section className="container-site py-14">
        <SectionHeading title="Shop by category" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {tiles.map((cat) => (
            <Link key={cat.id} href={`/collections/${cat.slug}`} className="group relative aspect-[3/4] overflow-hidden bg-line-soft">
              <Image
                src={cat.image ?? `https://picsum.photos/seed/cat-${cat.slug}/600/800`}
                alt={cat.name}
                fill
                sizes="(max-width:768px) 50vw, 20vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent p-4">
                <span className="text-lg font-medium uppercase tracking-wide text-white">{cat.name}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Shop by brand (directly after the category tiles) */}
      {brands.length > 0 && (
        <section className="container-site pb-14">
          <SectionHeading title="Shop by brand" href="/brands" />
          <BrandSlider brands={brands.map((b) => ({ name: b.name, slug: b.slug, banner: b.banner }))} />
        </section>
      )}

      {railAt("after-brands")}

      {/* Brand film, in line with the other sections */}
      <BrandVideo />

      {/* Featured: one row per department, up to 8 products each */}
      <section className="container-site py-6">
        <SectionHeading title="Featured" />
        <div className="space-y-12">
          {FEATURED_ROWS.map((row, i) =>
            featuredRows[i].products.length === 0 ? null : (
              <div key={row.slug}>
                <div className="mb-4 flex items-end justify-between">
                  <h3 className="text-lg font-medium uppercase tracking-wide">{row.title}</h3>
                  <Link href={`/collections/${row.slug}`} className="link-underline text-sm uppercase tracking-wide text-ink-soft">
                    View all
                  </Link>
                </div>
                <ScrollRail
                  label={`${row.title.toLowerCase()} products`}
                  itemClassName="basis-[calc((100%-1rem)/2)] md:basis-[calc((100%-2rem)/3)] lg:basis-[calc((100%-3rem)/4)]"
                >
                  {featuredRows[i].products.map((p) => (
                    <ProductCard key={p.id} product={p} currency={currency} />
                  ))}
                </ScrollRail>
              </div>
            ),
          )}
        </div>
      </section>

      {railAt("after-featured")}

      {/* Winter Collection banner, full width (lib/collection-heroes.ts) */}
      <WideBanner banner={HOME_WINTER} />

      {/* New arrivals */}
      <section className="container-site py-6">
        <SectionHeading title="New arrivals" href="/collections/women" />
        <ProductGrid products={newArrivals.products} currency={currency} />
      </section>

      {railAt("after-new")}

      {/* Outlet strip */}
      {outlet.products.length > 0 && (
        <section className="container-site py-6">
          <SectionHeading title="Outlet" href="/collections/outlet" cta="Shop sale" />
          <ProductGrid products={outlet.products} currency={currency} className="lg:grid-cols-4" />
        </section>
      )}

      {/* Customer reviews (chosen in Admin → Reviews) */}
      <CustomerReviewsCarousel reviews={homepageReviews} />

      {/* Value props */}
      <section className="border-t border-line">
        <div className="container-site grid gap-6 py-12 text-center sm:grid-cols-3">
          {[
            { t: "Free shipping", d: "On orders over Rs 15,000" },
            { t: "Easy returns", d: "14-day hassle-free returns" },
            { t: "Secure checkout", d: "COD, bank transfer & cards" },
          ].map((v) => (
            <div key={v.t}>
              <h3 className="text-sm font-medium uppercase tracking-wide">{v.t}</h3>
              <p className="mt-1 text-sm text-ink-muted">{v.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
