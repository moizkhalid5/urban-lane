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
 */
export function PageHeroBanner({ hero }: { hero: PageHero }) {
  return (
    <section
      id={HERO_ELEMENT_ID}
      className={cn("relative -mt-[49px] w-full overflow-hidden lg:-mt-[65px]", hero.menuBand ? "pt-[49px] lg:pt-[65px]" : "bg-ink")}
      style={hero.menuBand ? { backgroundColor: hero.menuBand } : undefined}
    >
      <div className={cn("relative", hero.aspect)}>
        <Image src={hero.image} alt={hero.alt} fill priority sizes="100vw" className="object-cover object-center" />
        {/* soft shade behind the white menu text on dark artwork */}
        {hero.tone === "dark" && !hero.menuBand && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
        )}
        {hero.link && <ArtworkBannerLinks image={hero.image} href={hero.link} label={hero.label ?? hero.alt} />}
      </div>
    </section>
  );
}
