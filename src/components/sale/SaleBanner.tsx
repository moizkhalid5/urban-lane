import type { CSSProperties } from "react";
import { ArtworkBannerLinks } from "@/components/ui/ArtworkBannerLinks";

/**
 * The 11.11 sale page's banner (artwork: Banners/11.11, split by scripts/build_sale_banner.py).
 * Computers and tablets get the 16:9 banner (1672x941), phones the tall one (941x1672), each at its own
 * shape so nothing is trimmed. The round "11.11 SALE ·" lettering is a separate transparent image laid
 * exactly over its place and slowly turning (still for visitors who ask for less motion); "UP TO 70% OFF"
 * in its middle stays still. The painted Shop Now (lib/banner-buttons.ts) leads to the products below.
 * Lossless WebP, shown as is. Each screen size loads only its own pictures.
 */
const DESKTOP = {
  image: "/images/sale/sale-banner-desktop-v1.webp",
  ring: "/images/sale/sale-banner-desktop-ring-v1.webp",
  width: 1672,
  height: 941,
  // the ring's square, in % of the picture (printed by the script)
  ringBox: { left: 27.63, top: 49.63, width: 21.53 },
};
const PHONE = {
  image: "/images/sale/sale-banner-phone-v1.webp",
  ring: "/images/sale/sale-banner-phone-ring-v1.webp",
  width: 941,
  height: 1672,
  ringBox: { left: 11.05, top: 60.83, width: 34.86 },
};

const ALT = "Urban Lane 11.11 Sale: best deals of the season, up to 70% off on select styles";
const MD = "(min-width: 768px)";

export function SaleBanner({ href, label }: { href: string; label: string }) {
  return (
    // Phones: edge to edge. Computers: within the page margins, no taller than the screen.
    <section aria-label="11.11 Sale" className="-mx-site-x md:mx-auto md:w-[min(100%,calc((100svh-150px)*1672/941))]">
      <div className="relative aspect-[941/1672] overflow-hidden bg-black md:aspect-[1672/941]">
        <picture>
          <source media={MD} srcSet={DESKTOP.image} width={DESKTOP.width} height={DESKTOP.height} />
          {/* eslint-disable-next-line @next/next/no-img-element -- artwork, served as is (lossless) */}
          <img
            src={PHONE.image}
            width={PHONE.width}
            height={PHONE.height}
            alt={ALT}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full"
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

        {/* the painted Shop Now: a real link over it, on each banner */}
        <div className="absolute inset-0 md:hidden">
          <ArtworkBannerLinks image={PHONE.image} href={href} label={label} />
        </div>
        <div className="absolute inset-0 hidden md:block">
          <ArtworkBannerLinks image={DESKTOP.image} href={href} label={label} />
        </div>
      </div>
    </section>
  );
}
