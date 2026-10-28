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
   * Phones (below md): show this picture instead, at its own shape. `image` and `aspect` are then only
   * used on tablets and computers.
   */
  small?: { image: string; aspect: string };
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
  // Department banners (from Banners/<department>/banner), the same shape as the homepage slider
  // (1916x821) and always the complete picture, never cropped. Men and Women are shown whole at every
  // screen size; Kids' plain cream background is extended at the sides to that shape (phones get the
  // original), with a cream strip under the menu so it doesn't cover the painted lettering.
  // Lossless WebP, shown as is (not re-compressed by next/image), so they keep the original quality.
  men: {
    image: "/images/banners/men-edit-full.webp",
    alt: "Urban Lane Men's Edit: refined layers for the modern man",
    tone: "dark",
    aspect: "aspect-[1897/829]",
  },
  women: {
    image: "/images/banners/women-edit-full.webp",
    alt: "Urban Lane Women's Edit: soft textures for a modern muse",
    tone: "dark",
    aspect: "aspect-[1916/821]",
  },
  kids: {
    image: "/images/banners/kids-edit-wide.webp",
    alt: "Urban Lane kids",
    tone: "light",
    aspect: "md:aspect-[2196/941]",
    menuBand: "#fbf7ed",
    small: { image: "/images/banners/kids.webp", aspect: "aspect-video" },
  },
};

/**
 * Homepage hero slider (components/home/HomeHeroSlider.tsx). Images: scripts/build_home_banners.py, from
 * the originals in Banners/:
 * - tablets and computers: the main banner's shape (2.334:1), `desktop` (+ a 960px version);
 * - phones: a taller 3:2 cut, `phone` (1200x800).
 * The pictures run up under the see-through menu; `tone` picks the menu text colour over their top edge
 * ("dark" → white text on a soft shade). Painted buttons: lib/banner-buttons.ts (keyed by file).
 */
export type HomeSlide = {
  key: string;
  desktop: string;
  desktopSmall: string;
  width: number;
  height: number;
  phone: string;
  alt: string;
  link: string;
  label: string;
  tone: "dark" | "light";
};

const slide = (
  key: string,
  width: number,
  height: number,
  rest: Omit<HomeSlide, "key" | "desktop" | "desktopSmall" | "phone" | "width" | "height">,
): HomeSlide => ({
  key,
  desktop: `/images/banners/home/${key}-${width}.webp`,
  desktopSmall: `/images/banners/home/${key}-960.webp`,
  phone: `/images/banners/home/${key}-m-1200.webp`,
  width,
  height,
  ...rest,
});

export const HOME_SLIDES: HomeSlide[] = [
  slide("urban-lane", 1916, 821, { alt: "Urban Lane", link: "/collections/women", label: "Shop now", tone: "light" }),
  slide("men-winter", 1897, 813, { alt: "Urban Lane men's winter collection: 30% sale", link: "/collections/winter?gender=men&save=1", label: "Shop the men's winter sale", tone: "dark" }),
  slide("women", 1862, 798, { alt: "Urban Lane online sale on womenswear", link: "/offers?gender=women", label: "Shop the womenswear sale", tone: "dark" }),
  slide("kids-summer", 2406, 1031, { alt: "Summer kids collection", link: "/collections/kids", label: "Discover kidswear", tone: "light" }),
  slide("sale-season", 1960, 840, { alt: "New season: 30% off, limited time offer", link: "/offers?save=25-35&gender=men,women,kids", label: "Shop the sale", tone: "dark" }),
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
