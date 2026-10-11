import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { nonEmptyCategoryIds } from "@/lib/queries/categories";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { ScrollRail } from "@/components/ui/ScrollRail";

/**
 * Top of the Men / Women collection pages: a banner carousel, then a row of square
 * category tiles with the name underneath. Artwork lives in public/images/<department>.
 */
type Landing = {
  banners: { image: string; alt: string; href: string }[];
  tiles: { slug: string; label: string; image: string }[];
};

const LANDINGS: Record<string, Landing> = {
  men: {
    banners: [
      { image: "/images/men/banner-sale.jpg", alt: "Men's apparel up to 50% off", href: "/collections/men?sort=price-asc" },
      { image: "/images/men/banner-new-arrivals.jpg", alt: "Men's new arrivals", href: "/collections/men?sort=latest" },
    ],
    tiles: [
      { slug: "men-tops", label: "Tops", image: "/images/men/cat-tops.jpg" },
      { slug: "men-trousers", label: "Trousers", image: "/images/men/cat-trousers.jpg" },
      { slug: "men-coats-and-jackets", label: "Coats & Jackets", image: "/images/men/cat-coats-and-jackets.jpg" },
      { slug: "men-suits", label: "Suits", image: "/images/men/cat-suits.jpg" },
      { slug: "men-underwear", label: "Underwear", image: "/images/men/cat-underwear.jpg" },
      { slug: "men-nightwear", label: "Nightwear", image: "/images/men/cat-nightwear.jpg" },
      { slug: "men-accessories", label: "Accessories", image: "/images/men/cat-accessories.jpg" },
    ],
  },
  women: {
    banners: [{ image: "/images/women/banner-autumn.jpg", alt: "Autumn in focus: new season, new looks", href: "/collections/women-coats-and-jackets" }],
    tiles: [
      { slug: "women-dresses", label: "Dresses", image: "/images/women/cat-dresses.jpg" },
      { slug: "women-tops", label: "Tops", image: "/images/women/cat-tops.jpg" },
      { slug: "women-trousers", label: "Trousers", image: "/images/women/cat-trousers.jpg" },
      { slug: "women-lingerie", label: "Lingerie", image: "/images/women/cat-lingerie.jpg" },
      { slug: "women-loungewear", label: "Loungewear", image: "/images/women/cat-loungewear.jpg" },
      { slug: "women-nightwear", label: "Nightwear", image: "/images/women/cat-nightwear.jpg" },
      { slug: "women-coats-and-jackets", label: "Coats & Jackets", image: "/images/women/cat-coats-and-jackets.jpg" },
      { slug: "women-activewear", label: "Activewear", image: "/images/women/cat-activewear.jpg" },
      { slug: "women-accessories", label: "Accessories", image: "/images/women/cat-accessories.jpg" },
    ],
  },
};

export const hasDepartmentLanding = (slug: string) => slug in LANDINGS;

export async function DepartmentLanding({ slug }: { slug: string }) {
  const landing = LANDINGS[slug];
  if (!landing) return null;

  // Hide tiles whose category has no products yet (same rule as the menu).
  const [nonEmpty, categories] = await Promise.all([
    nonEmptyCategoryIds(),
    prisma.category.findMany({ where: { slug: { in: landing.tiles.map((t) => t.slug) } }, select: { id: true, slug: true } }),
  ]);
  const idBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const tiles = landing.tiles.filter((t) => nonEmpty.has(idBySlug.get(t.slug) ?? ""));

  return (
    <div className="mt-4 space-y-10">
      <HeroCarousel
        slides={landing.banners.map((b) => ({ title: "", subtitle: b.alt, image: b.image, link: b.href }))}
        aspect="aspect-[27/10]"
        arrows
        inContainer
      />

      {tiles.length > 0 && (
        <ScrollRail
          label="categories"
          itemClassName="basis-[calc((100%-2rem)/3)] md:basis-[calc((100%-4rem)/5)] lg:basis-[calc((100%-6rem)/7)]"
        >
          {tiles.map((t) => (
            <Link key={t.slug} href={`/collections/${t.slug}`} className="group block text-center">
              <div className="relative aspect-square overflow-hidden bg-line-soft">
                <Image
                  src={t.image}
                  alt={t.label}
                  fill
                  sizes="(max-width:768px) 33vw, (max-width:1024px) 20vw, 15vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <span className="mt-3 block text-sm md:text-base">{t.label}</span>
            </Link>
          ))}
        </ScrollRail>
      )}
    </div>
  );
}
