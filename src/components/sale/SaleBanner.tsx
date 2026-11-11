import type { CSSProperties } from "react";
import { HERO_ELEMENT_ID } from "@/lib/collection-heroes";
import { ArtworkBannerLinks } from "@/components/ui/ArtworkBannerLinks";
import { cn } from "@/lib/utils";

/**
 * The 11.11 sale page's banner (artwork: Banners/11.11, split by scripts/build_sale_banner.py), edge to edge
 * at the top of the page like the collection banners: it slides up under the header's menu row, which is
 * see-through over it with dark text (white artwork; lib/collection-heroes.ts → heroForPath). A strip of the
 * banner's white the height of the menu row sits above the picture, so the menu never covers its lettering.
 *
 * Phones get the tall picture (941x1670) filling the screen; tablets and computers the 16:9 one (1671x941),
 * whole and as big as the screen allows, its white ground running out to the screen's edges (.sale-frame,
 * .sale-art in globals.css). One <picture>, so only the one for the screen is downloaded.
 *
 * The round "11.11 SALE ·" lettering is a separate transparent image laid exactly over its place and slowly
 * turning (still for visitors who ask for less motion); "UP TO 70% OFF" in its middle stays still. The
 * painted Shop Now (lib/banner-buttons.ts) leads to the products below. Lossless WebP, shown as is.
 */
const DESKTOP = {
  // white artwork: Banners/11.11/Urban Lane monochrome 11.11 sale banner.png, 1671x941
  image: "/images/sale/sale-banner-desktop-v2.webp",
  ring: "/images/sale/sale-banner-desktop-ring-v2.webp",
  // the ring's square, in % of the picture (printed by the script)
  ringBox: { left: 27.65, top: 49.63, width: 21.54 },
};
const PHONE = {
  // white artwork: Banners/11.11/Inverted 11.11 fashion sale banner.png, 941x1670
  image: "/images/sale/sale-banner-phone-v3.webp",
  ring: "/images/sale/sale-banner-phone-ring-v3.webp",
  ringBox: { left: 10.95, top: 60.84, width: 35.07 },
};

const ALT = "Urban Lane 11.11 Sale: best deals of the season, up to 70% off on select styles";
const MD = "(min-width: 768px)";
/** The banner's own white, so the strip under the menu and the screen's edges join it without a seam. */
const GROUND = "#fefefe";

export function SaleBanner({ href, label, hideOnPhones }: { href: string; label: string; hideOnPhones?: boolean }) {
  return (
    <section
      id={HERO_ELEMENT_ID}
      data-tone="light"
      aria-label="11.11 Sale"
      // -mt / pt: the menu row's height plus its 1px border (48px on phones and tablets, 64px from lg)
      className={cn("relative -mt-[49px] w-full overflow-hidden pt-[49px] lg:-mt-[65px] lg:pt-[65px]", hideOnPhones && "hidden md:block")}
      style={{ backgroundColor: GROUND }}
    >
      <div className="sale-frame">
        <div className="sale-art">
          <picture>
            <source media={MD} srcSet={DESKTOP.image} />
            {/* eslint-disable-next-line @next/next/no-img-element -- artwork, served as is (lossless) */}
            <img
              src={PHONE.image}
              alt={ALT}
              fetchPriority="high"
              decoding="async"
              // on wide screens the picture's left and right edges fade into the white around it
              className="absolute inset-0 h-full w-full md:[mask-image:linear-gradient(to_right,transparent,black_1.5%,black_98.5%,transparent)]"
            />
          </picture>

          {/* the turning ring, over the place it was painted */}
          <div
            aria-hidden
            className="pointer-events-none absolute aspect-square left-[var(--l)] top-[var(--t)] w-[var(--w)] md:left-[var(--ml)] md:top-[var(--mt)] md:w-[var(--mw)]"
            style={
              {
                "--l": `${PHONE.ringBox.left}%`,
                "--t": `${PHONE.ringBox.top}%`,
                "--w": `${PHONE.ringBox.width}%`,
                "--ml": `${DESKTOP.ringBox.left}%`,
                "--mt": `${DESKTOP.ringBox.top}%`,
                "--mw": `${DESKTOP.ringBox.width}%`,
              } as CSSProperties
            }
          >
            <picture>
              <source media={MD} srcSet={DESKTOP.ring} />
              {/* eslint-disable-next-line @next/next/no-img-element -- transparent lettering, served as is */}
              <img src={PHONE.ring} alt="" className="h-full w-full motion-safe:animate-spin-slow" />
            </picture>
          </div>

          {/* the painted Shop Now: a real link over it, on each picture */}
          <div className="absolute inset-0 md:hidden">
            <ArtworkBannerLinks image={PHONE.image} href={href} label={label} />
          </div>
          <div className="absolute inset-0 hidden md:block">
            <ArtworkBannerLinks image={DESKTOP.image} href={href} label={label} />
          </div>
        </div>
      </div>
    </section>
  );
}
