/**
 * Full-width banners at the top of a page (the homepage and /collections/<slug>). The header's menu row
 * is transparent over them (src/components/layout/Header.tsx). To add one, put the image in
 * public/images/banners and add it here.
 */
export type PageHero = {
  image: string;
  alt: string;
  /** The artwork behind the menu: "dark" → white menu text, "light" → dark menu text. */
  tone: "dark" | "light";
  /** Tailwind aspect-ratio classes per screen size. */
  aspect: string;
  /**
   * Keep the menu row off the artwork: a band of this colour (the artwork's own background) the height
   * of the menu row sits above the image, so the menu never covers the picture. Leave out to let the
   * image run under the menu.
   */
  menuBand?: string;
  /** Where the banner (or its painted button, see lib/banner-buttons.ts) leads. */
  link?: string;
  label?: string;
};

/** Collection banners, by collection slug. */
export const COLLECTION_HEROES: Record<string, PageHero> = {
  outlet: {
    image: "/images/banners/outlet-coming-soon.jpg",
    alt: "Urban Lane Outlet: coming soon",
    tone: "dark",
    // 3:1 on desktop like the artwork; taller crops on tablets and phones so it isn't a thin strip.
    aspect: "aspect-video md:aspect-[21/9] lg:aspect-[3/1]",
  },
};

/**
 * Homepage hero slider (components/home/HomeHeroSlider.tsx), all slides at the main banner's shape.
 * Images: scripts/build_home_banners.py (from the originals in Banners/). `band` is the colour of the
 * slide's top edge, used for the strip behind the menu; `tone` picks the menu text colour on it.
 * Painted buttons are in lib/banner-buttons.ts (keyed by `desktop`).
 */
export type HomeSlide = {
  key: string;
  desktop: string;
  mobile: string;
  width: number;
  height: number;
  alt: string;
  link: string;
  label: string;
  band: string;
  tone: "dark" | "light";
};

const slide = (key: string, width: number, height: number, rest: Omit<HomeSlide, "key" | "desktop" | "mobile" | "width" | "height">): HomeSlide => ({
  key,
  desktop: `/images/banners/home/${key}-${width}.webp`,
  mobile: `/images/banners/home/${key}-960.webp`,
  width,
  height,
  ...rest,
});

export const HOME_SLIDES: HomeSlide[] = [
  slide("urban-lane", 1916, 821, { alt: "Urban Lane", link: "/collections/women", label: "Shop now", band: "#faf9f9", tone: "light" }),
  slide("women", 1862, 798, { alt: "Urban Lane online sale on womenswear", link: "/collections/women", label: "Shop womenswear", band: "#8d8b8a", tone: "light" }),
  slide("men", 1672, 716, { alt: "Styles and fit: short-sleeve party wear shirts for men", link: "/collections/men", label: "Shop menswear", band: "#a7a995", tone: "light" }),
  slide("kids", 1672, 716, { alt: "Summer kids collection", link: "/collections/kids", label: "Discover kidswear", band: "#e5e4e4", tone: "light" }),
  slide("sale", 1672, 716, { alt: "New season: 30% off, limited time offer", link: "/collections/outlet", label: "Shop the sale", band: "#947557", tone: "dark" }),
];

/** A full-width banner inside a page: a wide cut for tablets and computers, the whole picture for phones. */
export type WideBannerConfig = {
  alt: string;
  link: string;
  label: string;
  wide: { full: string; small: string; width: number; height: number };
  phone: { full: string; small: string; width: number; height: number };
};

/** Homepage Winter Collection banner (images: scripts/build_home_banners.py, "winter-wide" and "winter"). */
export const HOME_WINTER: WideBannerConfig = {
  alt: "Winter collection: new season, higher ground. Modern style for a colder world.",
  link: "/collections/winter",
  label: "Discover the winter collection",
  wide: { full: "/images/banners/home/winter-wide-1916.webp", small: "/images/banners/home/winter-wide-960.webp", width: 1916, height: 504 },
  phone: { full: "/images/banners/home/winter-1916.webp", small: "/images/banners/home/winter-960.webp", width: 1916, height: 821 },
};

/** id of the banner element, so the header can tell when it has scrolled past it. */
export const HERO_ELEMENT_ID = "page-hero";

export function collectionHeroFor(slug: string): PageHero | null {
  return COLLECTION_HEROES[slug] ?? null;
}

/** Whether a page starts with a banner, and the menu text colour over it (first slide on the homepage). */
export function heroForPath(pathname: string | null): Pick<PageHero, "tone"> | null {
  if (pathname === "/") return { tone: HOME_SLIDES[0].tone };
  const slug = pathname?.match(/^\/collections\/([^/?#]+)\/?$/)?.[1];
  return slug ? collectionHeroFor(slug) : null;
}
