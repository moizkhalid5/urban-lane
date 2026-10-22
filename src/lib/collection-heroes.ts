/**
 * Full-width banners at the top of collection pages (/collections/<slug>). The header's menu row is
 * transparent over them (src/components/layout/Header.tsx). To add one, put the image in
 * public/images/banners and add the collection's slug here.
 */
export type CollectionHero = { image: string; alt: string };

export const COLLECTION_HEROES: Record<string, CollectionHero> = {
  outlet: {
    image: "/images/banners/outlet-coming-soon.jpg",
    alt: "Urban Lane Outlet: coming soon",
  },
};

/** id of the banner element, so the header can tell when it has scrolled past it. */
export const HERO_ELEMENT_ID = "page-hero";

export function collectionHeroFor(slug: string): CollectionHero | null {
  return COLLECTION_HEROES[slug] ?? null;
}

/** True on pages that start with a full-width banner, e.g. "/collections/outlet". */
export function pathHasHero(pathname: string | null): boolean {
  const slug = pathname?.match(/^\/collections\/([^/?#]+)\/?$/)?.[1];
  return !!slug && slug in COLLECTION_HEROES;
}
