import { ArtworkBannerLinks } from "@/components/ui/ArtworkBannerLinks";
import type { WideBannerConfig } from "@/lib/collection-heroes";

/**
 * Full-width artwork banner inside the homepage (e.g. Winter Collection): a wide cut on tablets and
 * computers, the whole picture on phones (a very wide strip would be too thin there). Images are
 * pre-optimised WebP (scripts/build_home_banners.py) served as they are; the painted button is a real
 * link (lib/banner-buttons.ts, keyed by each version's full-size file).
 */
export function WideBanner({ banner }: { banner: WideBannerConfig }) {
  const versions = [
    { v: banner.wide, className: "hidden md:block" },
    { v: banner.phone, className: "md:hidden" },
  ];
  return (
    <section aria-label={banner.alt} className="py-14">
      {versions.map(({ v, className }) => (
        <div key={v.full} className={`relative w-full overflow-hidden bg-line-soft ${className}`} style={{ aspectRatio: `${v.width} / ${v.height}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised artwork, served as is */}
          <img
            src={v.full}
            srcSet={`${v.small} 960w, ${v.full} ${v.width}w`}
            sizes="100vw"
            alt={banner.alt}
            width={v.width}
            height={v.height}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <ArtworkBannerLinks image={v.full} href={banner.link} label={banner.label} />
        </div>
      ))}
    </section>
  );
}
