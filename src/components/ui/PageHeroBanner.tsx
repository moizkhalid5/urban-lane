import Image from "next/image";
import { HERO_ELEMENT_ID, type PageHero } from "@/lib/collection-heroes";
import { ArtworkBannerLinks } from "@/components/ui/ArtworkBannerLinks";
import { cn } from "@/lib/utils";

/**
 * Edge-to-edge banner at the top of a page (e.g. Outlet). It slides up under the header's menu row
 * (-mt = the row's height plus its 1px border: 48px on phones and tablets, 64px from lg), which is
 * transparent while over the banner.
 * With `menuBand`, a strip of the artwork's background colour fills the space under the menu instead, so
 * the menu never covers the picture.
 * With `small`, phones get that picture and tablets and computers get `image` (one <picture>, so only the
 * one for the screen is downloaded). Banners are served as they are, at full quality, not re-compressed.
 */
export function PageHeroBanner({ hero }: { hero: PageHero }) {
  return (
    <section
      id={HERO_ELEMENT_ID}
      className={cn("relative -mt-[49px] w-full overflow-hidden lg:-mt-[65px]", hero.menuBand ? "pt-[49px] lg:pt-[65px]" : "bg-ink")}
      style={hero.menuBand ? { backgroundColor: hero.menuBand } : undefined}
    >
      <div className={cn("relative", hero.small?.aspect, hero.aspect)}>
        {hero.small ? <ArtDirected hero={hero} small={hero.small} /> : <Image src={hero.image} alt={hero.alt} fill priority unoptimized className="object-cover object-center" />}
        {/* soft shade behind the white menu text on dark artwork */}
        {hero.tone === "dark" && !hero.menuBand && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
        )}
        {hero.link && <ArtworkBannerLinks image={hero.image} href={hero.link} label={hero.label ?? hero.alt} />}
      </div>
    </section>
  );
}

function ArtDirected({ hero, small }: { hero: PageHero; small: NonNullable<PageHero["small"]> }) {
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={hero.image} />
      {/* eslint-disable-next-line @next/next/no-img-element -- full-quality artwork, shown as is */}
      <img src={small.image} alt={hero.alt} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover object-center" />
    </picture>
  );
}
