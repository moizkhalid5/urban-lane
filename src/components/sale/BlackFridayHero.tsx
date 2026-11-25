import { HERO_ELEMENT_ID } from "@/lib/collection-heroes";
import { BannerVideo } from "@/components/sale/BannerVideo";

/**
 * The Black Friday page's banner: a 16s film (Remotion, C:\Urbane Lane\reels\urbanlane-1111\src\BlackFriday.tsx;
 * masters in Banners/black friday) of the sale's garments gliding along a brass rail under a spotlight, each
 * with its real price, and the "Black Friday" title. It runs edge to edge under the see-through menu
 * (white text: lib/collection-heroes.ts → heroForPath).
 *
 * Phones: the 9:16 film fills the screen (.phone-frame). Tablets and computers: the 2.4:1 film, full width.
 * The poster (a still of the film's 2.5s mark) shows first, then the film takes over from that moment.
 *
 * The figures that can change (the top discount, the dates) are live text over the film, not part of it:
 * over its dark lower left on computers, its dark bottom on phones, and in a band under it on tablets.
 */
const FILM = {
  desktop: "/videos/black-friday-desktop-v1.mp4",
  phone: "/videos/black-friday-phone-v1.mp4",
  desktopPoster: "/images/sale/black-friday-desktop-poster-v1.webp",
  phonePoster: "/images/sale/black-friday-phone-poster-v1.webp",
  /** the poster is the film's frame 75 at 30fps */
  posterAt: 2.5,
};

const ALT =
  "Urban Lane Black Friday: a Next grey check jacket on a brass rail under a spotlight, Rs 41,000 now Rs 17,500";

export function BlackFridayHero({ line, cta }: { line: string; cta?: { href: string; label: string } }) {
  const overlay = (
    <div className="flex flex-col items-center gap-3 text-center lg:flex-row lg:items-center lg:gap-6 lg:text-left">
      <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-[#ecd6a4] lg:text-xs">{line}</p>
      {cta && (
        <a
          href={cta.href}
          className="rounded-full border border-[#c9a96e] bg-[#f3ede2] px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#070707] transition hover:bg-white"
        >
          {cta.label}
        </a>
      )}
    </div>
  );

  return (
    <section
      id={HERO_ELEMENT_ID}
      data-tone="dark"
      aria-label="Black Friday"
      // under the menu row (48px on phones and tablets, 64px from lg, each plus its 1px border)
      className="relative -mt-[49px] w-full overflow-hidden bg-[#070707] lg:-mt-[65px]"
    >
      <div className="phone-frame relative w-full md:aspect-[12/5]">
        <picture>
          <source media="(min-width: 768px)" srcSet={FILM.desktopPoster} />
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-made poster, served as is */}
          <img
            src={FILM.phonePoster}
            alt={ALT}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>
        <BannerVideo desktop={FILM.desktop} phone={FILM.phone} startAt={FILM.posterAt} />

        {/* phones: over the film's dark bottom; computers: under the title on the left */}
        <div className="absolute inset-x-4 bottom-[5%] md:hidden">{overlay}</div>
        <div className="absolute left-[5.83%] top-[80.5%] hidden lg:block">{overlay}</div>
      </div>
      {/* tablets: in a band under the film */}
      <div className="hidden px-4 pb-8 pt-2 md:block lg:hidden">{overlay}</div>
    </section>
  );
}
