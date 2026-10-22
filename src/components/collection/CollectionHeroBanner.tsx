import Image from "next/image";
import { HERO_ELEMENT_ID, type CollectionHero } from "@/lib/collection-heroes";

/**
 * Edge-to-edge banner at the top of a collection page. It slides up under the header's menu row
 * (-mt = the row's height: h-16 plus its 1px border), which is transparent while over the banner.
 * 3:1 on desktop like the artwork; taller crops on tablets and phones so the banner isn't a thin strip
 * under the menu (the centre of the image, with the headline and model, stays in view).
 */
export function CollectionHeroBanner({ hero }: { hero: CollectionHero }) {
  return (
    <section
      id={HERO_ELEMENT_ID}
      className="relative -mt-[65px] w-full overflow-hidden bg-ink"
    >
      <div className="relative aspect-video md:aspect-[21/9] lg:aspect-[3/1]">
        <Image
          src={hero.image}
          alt={hero.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* soft shade behind the transparent menu so it stays readable on any artwork */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
      </div>
    </section>
  );
}
