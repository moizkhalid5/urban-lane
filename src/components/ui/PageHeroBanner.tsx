import type { CSSProperties } from "react";
import Link from "next/link";
import { HERO_ELEMENT_ID, type PageHero } from "@/lib/collection-heroes";
import { ArtworkBannerLinks } from "@/components/ui/ArtworkBannerLinks";
import { cn } from "@/lib/utils";

/**
 * Edge-to-edge banner at the top of a page (e.g. Outlet). It slides up under the header's menu row
 * (-mt = the row's height plus its 1px border: 48px on phones and tablets, 64px from lg), which is
 * transparent while over the banner.
 * With `menuBand`, a strip of the artwork's background colour fills the space under the menu on tablets and
 * computers instead, so the menu never covers the picture.
 * Phones get `small`, filling the screen (.phone-frame), and tablets and computers get `image` (one
 * <picture>, so only the one for the screen is downloaded). Banners are served as they are, at full
 * quality, not re-compressed.
 * With `comingSoon`, the banner carries the message and the page's <h1>.
 */
export function PageHeroBanner({ hero, comingSoon }: { hero: PageHero; comingSoon?: PageHero["comingSoon"] }) {
  return (
    <section
      id={HERO_ELEMENT_ID}
      className={cn("relative -mt-[49px] w-full overflow-hidden lg:-mt-[65px]", hero.menuBand ? "md:pt-[49px] lg:pt-[65px]" : "bg-ink")}
      style={hero.menuBand ? { backgroundColor: hero.menuBand } : undefined}
    >
      <div className={cn("phone-frame relative", hero.wide && "fit-screen", hero.aspect)}>
        <div
          className="phone-cover"
          style={
            {
              "--art-ratio": hero.small.ratio ?? 941 / 1672,
              "--focus-x": hero.small.focus?.[0],
              "--focus-y": hero.small.focus?.[1],
              "--wide-ratio": hero.wide?.ratio,
              "--wide-focus-y": hero.wide?.focus,
            } as CSSProperties
          }
        >
          <picture>
            <source media="(min-width: 768px)" srcSet={hero.image} />
            {/* eslint-disable-next-line @next/next/no-img-element -- full-quality artwork, shown as is */}
            <img src={hero.small.image} alt={hero.alt} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover object-center" />
          </picture>
          {hero.link && (
            <>
              <div className="absolute inset-0 md:hidden">
                <ArtworkBannerLinks image={hero.small.image} href={hero.link} label={hero.label ?? hero.alt} />
              </div>
              <div className="absolute inset-0 hidden md:block">
                <ArtworkBannerLinks image={hero.image} href={hero.link} label={hero.label ?? hero.alt} />
              </div>
            </>
          )}
        </div>
        {/* soft shade behind the white menu text on dark artwork */}
        {hero.tone === "dark" && !hero.menuBand && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
        )}
        {comingSoon && (
          <div className="absolute inset-x-4 bottom-6 mx-auto max-w-md bg-white/90 px-6 py-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-md md:bottom-10">
            <h1 className="text-2xl font-medium">{comingSoon.title}</h1>
            <p className="mt-2 text-sm text-ink-soft">{comingSoon.text}</p>
            <Link href="/" className="btn-primary mt-5 inline-block">
              Continue shopping
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
