import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/guards";
import { FEATURED_DEPARTMENTS, MAX_FEATURED_PICKS, ensureFeaturedTables } from "@/lib/featured";
import { FeaturedAdmin } from "@/components/admin/FeaturedAdmin";

export const dynamic = "force-dynamic";

/** Admin → Homepage featured: which products show beside the photos in the homepage "Featured" rows. */
export default async function AdminFeaturedPage() {
  await requireStaff();
  await ensureFeaturedTables();
  const [picks, products] = await Promise.all([
    prisma.featuredPick.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        product: {
          select: {
            title: true,
            sku: true,
            slug: true,
            status: true,
            images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
            variants: { where: { isActive: true }, select: { stock: true } },
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: { title: "asc" },
      select: { id: true, title: true, sku: true, gender: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium">Homepage featured</h1>
        <Link href="/#featured-heading" target="_blank" className="btn-secondary">
          View homepage
        </Link>
      </div>
      <p className="max-w-3xl text-sm text-ink-muted">
        The homepage &ldquo;Featured&rdquo; section has a row for Men&apos;s, Women&apos;s and Kids&apos;: a photo on one half
        and products on the other. Choose the products for each row here, up to {MAX_FEATURED_PICKS}, in the order they
        should appear. A row with no products chosen shows that department&apos;s featured products automatically.
        Products that are hidden or sold out are skipped on the homepage.
      </p>
      <FeaturedAdmin
        departments={FEATURED_DEPARTMENTS.map((d) => ({ slug: d.slug, title: d.title }))}
        max={MAX_FEATURED_PICKS}
        picks={picks.map((p) => ({
          id: p.id,
          department: p.department,
          productId: p.productId,
          title: p.product.title,
          sku: p.product.sku,
          slug: p.product.slug,
          image: p.product.images[0]?.url ?? null,
          hidden: p.product.status !== "ACTIVE",
          soldOut: !p.product.variants.some((v) => v.stock > 0),
        }))}
        products={products.map((p) => ({ id: p.id, title: p.title, sku: p.sku, gender: p.gender, image: p.images[0]?.url ?? null }))}
      />
    </div>
  );
}
