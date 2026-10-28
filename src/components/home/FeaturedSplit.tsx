import Link from "next/link";
import type { ProductCard as ProductCardData } from "@/lib/queries/products";
import type { DisplayCurrency } from "@/lib/money";
import { ProductCard } from "@/components/product/ProductCard";
import { ScrollRail } from "@/components/ui/ScrollRail";
import { cn } from "@/lib/utils";

export type FeaturedDepartment = {
  slug: string;
  title: string;
  /** Square photo in public/images/featured: `<photo>-1254.webp` and `<photo>-720.webp` */
  photo: string;
  alt: string;
  blurb: string;
  products: ProductCardData[];
};

/**
 * Homepage "Featured": one row per department. On computers each row is split in half, a full-height
 * photo on one side and the department's products on the other, swapping sides row by row. Phones and
 * tablets show the photo above the products.
 */
export function FeaturedSplit({ departments, currency }: { departments: FeaturedDepartment[]; currency: DisplayCurrency }) {
  const rows = departments.filter((d) => d.products.length > 0);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="featured-heading" className="py-10 md:py-14">
      <div className="container-site mb-8 text-center md:mb-12">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-muted">Featured</p>
        <h2 id="featured-heading" className="mt-2 text-4xl font-bold uppercase leading-[0.95] tracking-tight md:text-6xl">
          Made for
          <br />
          every day
        </h2>
      </div>

      {rows.map((d, i) => {
        const photoRight = i % 2 === 1;
        return (
          <div key={d.slug} className="lg:grid lg:grid-cols-2">
            {/* Photo: square on phones and computers, a wider cut on tablets */}
            <Link
              href={`/collections/${d.slug}`}
              aria-label={`Shop all ${d.title}`}
              className={cn("relative block aspect-square overflow-hidden bg-line-soft md:aspect-[3/2] lg:aspect-square", photoRight && "lg:order-2")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP, served as is */}
              <img
                src={`/images/featured/${d.photo}-1254.webp`}
                srcSet={`/images/featured/${d.photo}-720.webp 720w, /images/featured/${d.photo}-1254.webp 1254w`}
                sizes="(min-width: 1024px) 50vw, 100vw"
                alt={d.alt}
                width={1254}
                height={1254}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-700 ease-premium hover:scale-[1.03] lg:object-center"
              />
            </Link>

            {/* Products */}
            <div className="flex min-w-0 flex-col justify-center px-4 py-10 sm:px-8 lg:px-16 xl:px-24">
              <h3 className="text-4xl font-bold uppercase leading-none tracking-tight md:text-5xl">{d.title}</h3>
              <div className="mt-6 lg:mt-8">
                <ScrollRail
                  label={`${d.title.toLowerCase()} products`}
                  itemClassName="basis-[calc((100%-1rem)/2.15)] md:basis-[calc((100%-2rem)/3.15)] lg:basis-[calc((100%-2rem)/2.35)]"
                >
                  {d.products.map((p) => (
                    <ProductCard key={p.id} product={p} currency={currency} />
                  ))}
                </ScrollRail>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-[16rem] text-xs uppercase leading-snug tracking-wide text-ink-muted">{d.blurb}</p>
                <Link
                  href={`/collections/${d.slug}`}
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium uppercase tracking-wide text-white transition-colors hover:bg-ink/85"
                >
                  Shop all {d.title}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <path d="M7 17 17 7M8 7h9v9" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
