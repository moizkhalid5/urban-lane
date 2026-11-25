import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/site";
import { activeSale } from "@/lib/sale";
import { brandProductCounts, indexableCategoryIds } from "@/lib/seo/indexing";

// Generated at request time, not at build (the build has no DATABASE_URL).
export const dynamic = "force-dynamic";

/**
 * Absolute, XML-safe address of an uploaded photo. Next.js writes sitemap URLs into the XML as they are, so
 * spaces and the like are percent-encoded and "&" (legal in a path, fatal in XML) becomes %26, which the file
 * server decodes back to the same file.
 */
const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : `${APP_URL}${encodeURI(path)}`).replace(/&/g, "%26");

/**
 * Every page worth finding on Google, with each product's photos (an image sitemap: fashion gets a lot of
 * its search traffic from Google Images). Empty or leftover listing pages are left out (lib/seo/indexing.ts).
 * lastModified is only given where it's real (Google ignores dates that are always "now"); priority and
 * changeFrequency are left out because Google ignores them.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: APP_URL },
    ...["/brands", "/about", "/contact", "/faq", "/shipping-policy", "/returns"].map((path) => ({ url: `${APP_URL}${path}` })),
  ];

  // Resilient: if the DB is unreachable, still return the static pages (the build never needs a database).
  try {
    const [categories, indexable, products, brands, counts, sale] = await Promise.all([
      prisma.category.findMany({ where: { isActive: true }, select: { id: true, slug: true, updatedAt: true }, orderBy: [{ level: "asc" }, { position: "asc" }] }),
      indexableCategoryIds(),
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { slug: true, updatedAt: true, images: { orderBy: { position: "asc" }, take: 10, select: { url: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.brand.findMany({ select: { id: true, slug: true, updatedAt: true } }),
      brandProductCounts(),
      activeSale(),
    ]);
    if (sale) pages.push({ url: `${APP_URL}${sale.event.href}` });
    pages.push(
      ...categories.filter((c) => indexable.has(c.id)).map((c) => ({ url: `${APP_URL}/collections/${c.slug}`, lastModified: c.updatedAt })),
      ...brands.filter((b) => counts.get(b.id)).map((b) => ({ url: `${APP_URL}/brands/${b.slug}`, lastModified: b.updatedAt })),
      ...products.map((p) => ({
        url: `${APP_URL}/products/${p.slug}`,
        lastModified: p.updatedAt,
        images: p.images.map((i) => absolute(i.url)),
      })),
    );
  } catch {
    // DB unavailable (e.g. during build): static pages only.
  }
  return pages;
}
