import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { listProducts } from "@/lib/queries/products";
import { getActiveCurrency } from "@/lib/currency.server";
import { ProductGrid } from "@/components/product/ProductGrid";
import { BrandSlider } from "@/components/home/BrandSlider";
import { BrandVideo } from "@/components/home/BrandVideo";
import { CustomerReviewsCarousel } from "@/components/reviews/CustomerReviewsCarousel";
import { getHomepageReviews } from "@/lib/reviews/queries";
import { HomeHeroSlider } from "@/components/home/HomeHeroSlider";
import { HOME_SLIDES, HOME_WINTER } from "@/lib/collection-heroes";
import { WideBanner } from "@/components/home/WideBanner";
import { HangingRail } from "@/components/home/HangingRail";
import { FeaturedSplit } from "@/components/home/FeaturedSplit";
import { getFeaturedPickIds } from "@/lib/featured";
import { getProductsByIds } from "@/lib/queries/product-detail";
import { getHomepageRail } from "@/lib/rail/queries";
import { SalePoster } from "@/components/home/SalePoster";
import { SALE, activeSale } from "@/lib/sale";
import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/settings";
import { homeMetadata, rupees } from "@/lib/seo/meta";
import { organizationLd, websiteLd } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/seo/JsonLd";

/** Brands with the most live products, biggest first (homepage title, description and intro). */
async function topBrands(take: number) {
  const rows = await prisma.product.groupBy({
    by: ["brandId"],
    where: { status: "ACTIVE", brandId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { brandId: "desc" } },
    take,
  });
  const brands = await prisma.brand.findMany({ where: { id: { in: rows.map((r) => r.brandId!) } }, select: { id: true, name: true, slug: true } });
  return rows.map((r) => brands.find((b) => b.id === r.brandId)!).filter(Boolean);
}

/** "Original UK Brands Online in Pakistan | Urban Lane" (lib/seo/meta.ts). */
export async function generateMetadata(): Promise<Metadata> {
  const [settings, brands] = await Promise.all([getSiteSettings(), topBrands(4)]);
  return homeMetadata(settings, brands.map((b) => b.name));
}

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

// "Featured": one half-photo, half-products row per department (photos: public/images/featured; products:
// Admin → Homepage featured).
const FEATURED_ROWS = [
  {
    slug: "men",
    title: "Men's",
    photo: "men",
    alt: "Man in a blue checked three-piece suit walking over golden hills",
    blurb: "Suits, shirts, chinos and jeans from the UK high street.",
  },
  {
    slug: "women",
    title: "Women's",
    photo: "women",
    alt: "Woman in a sage utility jacket walking through tall grass below snowy mountains",
    blurb: "Jackets, dresses and everyday pieces, picked for you.",
  },
  {
    slug: "kids",
    title: "Kids'",
    photo: "kids",
    alt: "Girl in a red dress and brown boots holding a toy horse beside a stable",
    blurb: "Sets, dresses and tops for babies and children.",
  },
];

export default async function HomePage() {
  const currency = await getActiveCurrency();

  const [featuredRows, newArrivals, outlet, tiles, brands, homepageReviews, rail, sale, settings, leading] = await Promise.all([
    // Products chosen in Admin → Homepage featured, or else the department's featured products
    getFeaturedPickIds().then((picks) =>
      Promise.all(
        FEATURED_ROWS.map(async (r) =>
          picks[r.slug]?.length
            ? { products: (await getProductsByIds(picks[r.slug])).filter((p) => p.inStock) }
            : listProducts({ categorySlug: r.slug, sort: "featured", pageSize: 8 }),
        ),
      ),
    ),
    listProducts({ sort: "latest", pageSize: 8 }),
    listProducts({ saleOnly: true, pageSize: 4 }),
    prisma.category.findMany({
      // Menu departments only; seasonal collections (e.g. Winter) are reached from banners. Jewellery stays in
      // the menu but not in these tiles.
      where: { level: 0, isVirtual: false, isActive: true, showInNav: true, slug: { not: "jewellery" } },
      orderBy: { position: "asc" },
      take: 4,
    }),
    prisma.brand.findMany({ where: { isFeatured: true }, orderBy: { position: "asc" } }),
    getHomepageReviews(15),
    getHomepageRail(),
    activeSale(),
    getSiteSettings(),
    topBrands(8),
  ]);

  // Hanging rail (Admin → Homepage rail), at the place chosen there
  const railAt = (placement: string) =>
    rail?.settings.placement === placement ? <HangingRail collections={rail.collections} currency={currency} heading={rail.settings.heading} /> : null;

  return (
    <>
      {/* Who we are, for Google: the shop, its shipping and returns, and the site name (lib/seo/structured-data.ts) */}
      <JsonLd data={organizationLd(settings)} />
      <JsonLd data={websiteLd(settings.storeName)} />

      {/* Full-width banner slider under the transparent menu (slides: lib/collection-heroes.ts) */}
      <HomeHeroSlider slides={HOME_SLIDES} sale={sale && { maxPct: sale.maxPct, href: SALE.href, name: SALE.name }} />

      {/* The page's main heading: the banners are pictures, so this line says in words what the shop is. */}
      <div className="container-site pt-10 text-center">
        <h1 className="text-xs font-medium uppercase tracking-[0.25em] text-ink-muted md:text-sm">Original UK high-street brands, delivered across Pakistan</h1>
      </div>

      {/* During the 11.11 sale: its poster pops up once per visitor at the rail (lib/sale.ts) */}
      {sale && <SalePoster name={SALE.name} href={SALE.href} poster={SALE.poster} storageKey="sale-1111-poster-seen" />}

      {railAt("after-hero")}

      {/* Category tiles */}
      <section className="container-site py-14">
        <SectionHeading title="Shop by category" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {tiles.map((cat) => (
            <Link key={cat.id} href={`/collections/${cat.slug}`} className="group relative aspect-[3/4] overflow-hidden bg-line-soft">
              <Image
                src={cat.image ?? `https://picsum.photos/seed/cat-${cat.slug}/600/800`}
                alt={cat.name}
                fill
                sizes="(max-width:768px) 50vw, 25vw"
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
      <FeaturedSplit departments={FEATURED_ROWS.map((r, i) => ({ ...r, products: featuredRows[i].products }))} currency={currency} />

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

      {/* About the shop, in words: what it sells, how paying and delivery work, where to start. */}
      <section className="border-t border-line">
        <div className="container-site grid gap-10 py-14 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <h2 className="text-2xl font-medium md:text-3xl">UK brands in Pakistan, the original way</h2>
            <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <p>
                Urban Lane brings the UK high street to Pakistan: original clothing from{" "}
                {leading.filter((b) => !/maybelline|l'?or[eé]al|nyx|rimmel|max factor|revlon/i.test(b.name)).slice(0, 5).map((b) => b.name).join(", ")} and more,
                and makeup from Maybelline, L&apos;Oréal Paris, NYX and Rimmel, all priced in rupees.
              </p>
              <p>
                Shop women&apos;s dresses, tops and lingerie; men&apos;s shirts, chinos, jeans and suits; kids&apos; and baby clothes from newborn to
                8 years; and original makeup. Pay cash on delivery or with Easypaisa or JazzCash. Delivery takes 3–5 working days
                {settings.freeShippingThresholdCents != null ? ` and is free on orders over ${rupees(settings.freeShippingThresholdCents)}` : ""}, and
                you have 14 days to return anything that isn&apos;t right.
              </p>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <nav aria-label="Departments">
              <h3 className="text-sm font-medium uppercase tracking-wide">Departments</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                {[
                  ["Women's clothing", "/collections/women"],
                  ["Men's clothing", "/collections/men"],
                  ["Kids' & baby clothes", "/collections/kids"],
                  ["Original makeup", "/collections/beauty"],
                ].map(([name, href]) => (
                  <li key={href}>
                    <Link href={href} className="hover:text-ink hover:underline">
                      {name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Popular brands">
              <h3 className="text-sm font-medium uppercase tracking-wide">Popular brands</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                {leading.map((b) => (
                  <li key={b.slug}>
                    <Link href={`/brands/${b.slug}`} className="hover:text-ink hover:underline">
                      {b.name} Pakistan
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="border-t border-line">
        <div className="container-site grid gap-6 py-12 text-center sm:grid-cols-3">
          {[
            { t: "Free shipping", d: "On orders over Rs 15,000" },
            { t: "Easy returns", d: "14-day hassle-free returns" },
            { t: "Easy payment", d: "Cash on delivery, Easypaisa & JazzCash" },
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
