import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { listProducts } from "@/lib/queries/products";
import { getActiveCurrency } from "@/lib/currency.server";
import { ProductGrid } from "@/components/product/ProductGrid";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { BrandSlider } from "@/components/home/BrandSlider";

export const revalidate = 300;

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

export default async function HomePage() {
  const currency = await getActiveCurrency();

  const [heroBanners, promoBanner, featured, newArrivals, outlet, tiles, brands] = await Promise.all([
    prisma.banner.findMany({ where: { kind: "HERO", isActive: true }, orderBy: { position: "asc" } }),
    prisma.banner.findFirst({ where: { kind: "PROMO", isActive: true }, orderBy: { position: "asc" } }),
    listProducts({ sort: "featured", pageSize: 8 }),
    listProducts({ sort: "latest", pageSize: 8 }),
    listProducts({ saleOnly: true, pageSize: 4 }),
    prisma.category.findMany({
      where: { level: 0, isVirtual: false, isActive: true },
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

      {/* Featured */}
      <section className="container-site py-6">
        <SectionHeading title="Featured" href="/collections/women" cta="Shop new in" />
        <ProductGrid products={featured.products} currency={currency} />
      </section>

      {/* Promo banner */}
      {promoBanner && (
        <section className="container-site py-14">
          <Link href={promoBanner.link ?? "/collections/outlet"} className="group relative block aspect-[21/9] overflow-hidden bg-line-soft md:aspect-[3/1]">
            {promoBanner.image && (
              <Image src={promoBanner.image} alt={promoBanner.title ?? "Promotion"} fill sizes="100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 text-center text-white">
              <h2 className="text-3xl font-medium md:text-4xl">{promoBanner.title}</h2>
              {promoBanner.subtitle && <p className="mt-2 text-white/85">{promoBanner.subtitle}</p>}
            </div>
          </Link>
        </section>
      )}

      {/* New arrivals */}
      <section className="container-site py-6">
        <SectionHeading title="New arrivals" href="/collections/women" />
        <ProductGrid products={newArrivals.products} currency={currency} />
      </section>

      {/* Brand slider (issues doc) */}
      {brands.length > 0 && (
        <section className="container-site py-14">
          <SectionHeading title="Shop by brand" href="/brands" />
          <BrandSlider brands={brands.map((b) => ({ name: b.name, slug: b.slug, banner: b.banner }))} />
        </section>
      )}

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
