import Link from "next/link";
import Image from "next/image";
import { Playfair_Display } from "next/font/google";
import { listProducts } from "@/lib/queries/products";
import { ProductCard } from "@/components/product/ProductCard";
import { ScrollRail } from "@/components/ui/ScrollRail";
import type { DisplayCurrency } from "@/lib/money";

const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-beauty-serif", display: "swap" });

/** The Beauty pages' soft peach look: background, serif headings, rounded rose buttons (.beauty-theme in globals.css). */
export function BeautyTheme({ children }: { children: React.ReactNode }) {
  return <div className={`${serif.variable} beauty-theme`}>{children}</div>;
}

/** "Best Sellers" only once products have really sold; until then the same row is "Our Picks". */
const MIN_BEST_SELLERS = 4;

function Heading({ children }: { children: string }) {
  return <h2 className="mb-6 text-2xl md:text-3xl">{children}</h2>;
}

/**
 * Top of the Beauty collection page (under the full-width banner, lib/collection-heroes.ts): category tiles,
 * a row of top products, then a row of new arrivals. The product cards are the site's usual ones.
 */
export async function BeautyLanding({
  categories,
  currency,
}: {
  categories: { name: string; slug: string }[];
  currency: DisplayCurrency;
}) {
  const [tiles, { products: topSellers }, { products: newest }, { products: picks }] = await Promise.all([
    // Each tile shows its category's top product.
    Promise.all(
      categories.map(async (c) => {
        const { products } = await listProducts({ categorySlug: c.slug, sort: "featured", pageSize: 1 });
        return { ...c, image: products[0]?.image ?? null };
      }),
    ),
    listProducts({ categorySlug: "beauty", sort: "best-selling", pageSize: 4 }),
    listProducts({ categorySlug: "beauty", sort: "latest", pageSize: 8 }),
    listProducts({ categorySlug: "beauty", sort: "featured", pageSize: 6 }),
  ]);

  const sold = topSellers.filter((p) => p.salesCount > 0);
  const hasBestSellers = sold.length >= MIN_BEST_SELLERS;
  const top = hasBestSellers ? sold : picks.slice(0, 4);
  const shown = new Set(top.map((p) => p.id));
  const arrivals = newest.filter((p) => !shown.has(p.id)).slice(0, 4);

  return (
    <div className="mt-6 space-y-14">
      <section>
        <Heading>Shop by category</Heading>
        <ScrollRail
          label="beauty categories"
          itemClassName="basis-[calc((100%-1rem)/2)] md:basis-[calc((100%-3rem)/4)] lg:basis-[calc((100%-4rem)/5)]"
        >
          {tiles.map((t) => (
            <Link key={t.slug} href={`/collections/${t.slug}`} className="group block">
              <div className="beauty-tile relative aspect-square overflow-hidden rounded-xl">
                {t.image && (
                  <Image
                    src={t.image}
                    alt=""
                    fill
                    sizes="(max-width:768px) 50vw, (max-width:1024px) 25vw, 20vw"
                    // White product-photo backgrounds melt into the tile's peach.
                    className="object-contain p-6 mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                  />
                )}
              </div>
              <span className="beauty-serif mt-3 block text-lg">{t.name}</span>
            </Link>
          ))}
        </ScrollRail>
      </section>

      {top.length > 0 && (
        <section>
          <Heading>{hasBestSellers ? "Best Sellers" : "Our Picks"}</Heading>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {top.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} />
            ))}
          </div>
        </section>
      )}

      {arrivals.length > 0 && (
        <section>
          <Heading>New Arrivals</Heading>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {arrivals.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
