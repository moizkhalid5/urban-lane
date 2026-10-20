import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { listProducts } from "@/lib/queries/products";
import { getActiveCurrency } from "@/lib/currency.server";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductCard } from "@/components/product/ProductCard";
import { ScrollRail } from "@/components/ui/ScrollRail";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { BrandSlider } from "@/components/home/BrandSlider";
import { BrandVideo } from "@/components/home/BrandVideo";
import { ArtworkBannerLinks } from "@/components/ui/ArtworkBannerLinks";
import { bannerButtonFor } from "@/lib/banner-buttons";

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

  const [heroBanners, promoBanner, featuredRows, newArrivals, outlet, tiles, brands] = await Promise.all([
    prisma.banner.findMany({ where: { kind: "HERO", isActive: true }, orderBy: { position: "asc" } }),
    prisma.banner.findFirst({ where: { kind: "PROMO", isActive: true }, orderBy: { position: "asc" } }),
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
  ]);

  return (
    <>
      <HeroCarousel
        slides={heroBanners.map((b) => ({ title: b.title ?? "", subtitle: b.subtitle, image: b.image, link: b.link }))}
      />

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

      {/* Promo banner */}
      {promoBanner && (
        <section className="container-site py-14">
          {/* No title = artwork banner with its text in the image: show it uncropped (16:9) with no overlay. */}
          <div
            className={cn(
              "group relative block overflow-hidden bg-line-soft",
              promoBanner.title ? "aspect-[21/9] md:aspect-[3/1]" : "aspect-[16/9]",
            )}
          >
            {promoBanner.image && (
              <Image
                src={promoBanner.image}
                alt={promoBanner.title ?? promoBanner.subtitle ?? "Promotion"}
                fill
                sizes="(max-width:1400px) 100vw, 1400px"
                className={cn(
                  "object-cover",
                  // No zoom when the painted button is the link: zooming would move it out from under its link.
                  !bannerButtonFor(promoBanner.image) && "transition-transform duration-700 group-hover:scale-105",
                )}
              />
            )}
            {promoBanner.title && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 text-center text-white">
                <h2 className="text-3xl font-medium md:text-4xl">{promoBanner.title}</h2>
                {promoBanner.subtitle && <p className="mt-2 text-white/85">{promoBanner.subtitle}</p>}
              </div>
            )}
            <ArtworkBannerLinks
              image={promoBanner.title ? null : promoBanner.image}
              href={promoBanner.link ?? "/collections/outlet"}
              label={promoBanner.title ?? promoBanner.subtitle ?? "Promotion"}
            />
          </div>
        </section>
      )}

      {/* New arrivals */}
      <section className="container-site py-6">
        <SectionHeading title="New arrivals" href="/collections/women" />
        <ProductGrid products={newArrivals.products} currency={currency} />
      </section>

      {/* Outlet strip */}
      {outlet.products.length > 0 && (
        <section className="container-site py-6">
          <SectionHeading title="Outlet" href="/collections/outlet" cta="Shop sale" />
          <ProductGrid products={outlet.products} currency={currency} className="lg:grid-cols-4" />
        </section>
      )}

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
