import Link from "next/link";
import Image from "next/image";
import { ScrollRail } from "@/components/ui/ScrollRail";
import { AGE_BANDS } from "@/lib/kids-age";

/**
 * Top of the Kids collection page: banner, then Shop by brand / age / gender.
 * Artwork (with its labels baked in) lives in public/images/kids.
 */
const BRANDS = [
  { slug: "h-and-m", name: "H&M" },
  { slug: "m-and-s", name: "M&S" },
  { slug: "matalan", name: "Matalan" },
  { slug: "next", name: "Next" },
  { slug: "tu-clothing", name: "Tu" },
];

const GENDERS = [
  { name: "Baby Girls 0-24M", slug: "kids-baby-girls-0-24m", image: "gender-baby-girls" },
  { name: "Baby Boys 0-24M", slug: "kids-baby-boys-0-24m", image: "gender-baby-boys" },
  { name: "Girls 2-8 Years", slug: "kids-girls-2-8-yrs", image: "gender-girls" },
  { name: "Boys 2-8 Years", slug: "kids-boys-2-8-yrs", image: "gender-boys" },
];

function Heading({ children }: { children: string }) {
  return <h2 className="mb-6 text-2xl font-medium md:text-3xl">{children}</h2>;
}

function Card({ href, image, label, aspect }: { href: string; image: string; label: string; aspect: string }) {
  return (
    <Link href={href} aria-label={label} className={`group relative block overflow-hidden rounded-2xl bg-line-soft ${aspect}`}>
      <Image
        src={`/images/kids/${image}.jpg`}
        alt={label}
        fill
        sizes="(max-width:768px) 50vw, (max-width:1024px) 33vw, 20vw"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </Link>
  );
}

export function KidsLanding() {
  return (
    <div className="mt-4 space-y-14">
      <div className="relative aspect-[2/1] w-full overflow-hidden">
        <Image src="/images/kids/banner-2x1.jpg" alt="Urban Lane kids" fill priority sizes="(max-width:1440px) 100vw, 1312px" className="object-cover" />
      </div>

      <section>
        <Heading>Shop by brand</Heading>
        <ScrollRail label="brands" itemClassName="basis-[calc((100%-1rem)/2)] md:basis-[calc((100%-2rem)/3)] lg:basis-[calc((100%-4rem)/5)]">
          {BRANDS.map((b) => (
            <Card key={b.slug} href={`/collections/kids?brands=${b.slug}`} image={`brand-${b.slug}`} label={`Kids' ${b.name}`} aspect="aspect-[2/3]" />
          ))}
        </ScrollRail>
      </section>

      <section>
        <Heading>Shop by age</Heading>
        <ScrollRail label="ages" itemClassName="basis-[calc((100%-1rem)/2)] md:basis-[calc((100%-2rem)/3)] lg:basis-[calc((100%-5rem)/6)]">
          {AGE_BANDS.map((a) => (
            <Card key={a.key} href={`/collections/kids?ages=${a.key}`} image={`age-${a.key}`} label={a.label} aspect="aspect-[4/5]" />
          ))}
        </ScrollRail>
      </section>

      <section>
        <Heading>Shop by gender</Heading>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {GENDERS.map((g) => (
            <Card key={g.slug} href={`/collections/${g.slug}`} image={g.image} label={g.name} aspect="aspect-[4/5]" />
          ))}
        </div>
      </section>
    </div>
  );
}
