import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BrandSlider } from "@/components/home/BrandSlider";

export const metadata: Metadata = {
  title: "All Brands",
  description: "Shop all brands at Urban Lane.",
  alternates: { canonical: "/brands" },
};

export default async function BrandsPage() {
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });
  const featured = brands.filter((b) => b.isFeatured);

  // Group alphabetically.
  const groups = new Map<string, typeof brands>();
  for (const b of brands) {
    const letter = b.name[0].toUpperCase();
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter)!.push(b);
  }

  return (
    <div className="container-site py-10">
      <h1 className="text-3xl font-medium md:text-4xl">All Brands</h1>
      <p className="mt-2 text-ink-muted">Discover the labels we carry.</p>

      {featured.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-medium">Featured brands</h2>
          <BrandSlider brands={featured.map((b) => ({ name: b.name, slug: b.slug, banner: b.banner }))} />
        </section>
      )}

      <section className="mt-12 space-y-8">
        {[...groups.entries()].map(([letter, items]) => (
          <div key={letter}>
            <h3 className="mb-3 border-b border-line pb-2 text-sm font-medium uppercase tracking-wide text-ink-muted">
              {letter}
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
              {items.map((b) => (
                <Link key={b.id} href={`/brands/${b.slug}`} className="py-1 text-sm text-ink-soft transition-colors hover:text-ink">
                  {b.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
