import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts, getProductsByIds } from "@/lib/queries/product-detail";
import { getCategoryWithAncestors } from "@/lib/queries/categories";
import { getActiveCurrency } from "@/lib/currency.server";
import { formatMoney } from "@/lib/money";
import { ProductGallery } from "@/components/product/ProductGallery";
import { AddToCart } from "@/components/product/AddToCart";
import { Accordion } from "@/components/ui/Accordion";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Price } from "@/components/ui/Price";
import { ProductGrid } from "@/components/product/ProductGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrackRecentlyViewed } from "@/components/product/TrackRecentlyViewed";
import { WishlistButton } from "@/components/product/WishlistButton";
import { getCurrentUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ slug: string }> };

const APP_URL = process.env.APP_URL || "http://localhost:3000";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const image = product.images[0]?.url;
  return {
    title: product.seoTitle || product.title,
    description: product.seoDescription || product.description?.slice(0, 160) || `Shop ${product.title} at Urbane Lane.`,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.title,
      url: `/products/${product.slug}`,
      images: image ? [image] : undefined,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const currency = await getActiveCurrency();
  const primaryCategory = product.categories[0]?.category;
  const catData = primaryCategory ? await getCategoryWithAncestors(primaryCategory.slug) : null;

  const crumbs = [
    ...(catData ? catData.ancestors : []),
    ...(primaryCategory ? [{ name: primaryCategory.name, href: `/collections/${primaryCategory.slug}` }] : []),
    { name: product.title, href: `/products/${product.slug}` },
  ];

  const related = await getRelatedProducts(product.id, primaryCategory?.id, 4);

  // Recently viewed (cookie set client-side on previous views; excludes current product).
  const recentIds = (await cookies()).get("ul_recent")?.value?.split(",").filter(Boolean) ?? [];
  const recentlyViewed = await getProductsByIds(recentIds.filter((id) => id !== product.id).slice(0, 4));

  const variantOptions = product.variants.map((v) => ({
    id: v.id,
    size: v.size,
    color: v.color,
    colorHex: v.colorHex,
    stock: v.stock,
  }));

  const inStock = product.variants.some((v) => v.stock > 0);

  const currentUser = await getCurrentUser();
  const wishlisted = currentUser
    ? !!(await prisma.wishlistItem.findUnique({
        where: { userId_productId: { userId: currentUser.id, productId: product.id } },
      }))
    : false;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: product.images.map((i) => i.url),
    description: product.description ?? undefined,
    sku: product.sku ?? undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: currency.code,
      price: (product.priceCents / 100) * currency.rate,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${APP_URL}/products/${product.slug}`,
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${APP_URL}${c.href}`,
    })),
  };

  const details = (product.details ?? "").split("\n").filter(Boolean);

  return (
    <div className="container-site py-8">
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbLd} />
      <TrackRecentlyViewed productId={product.id} />

      <Breadcrumbs items={crumbs} />

      <div className="mt-6 grid gap-10 md:grid-cols-2 lg:gap-16">
        <ProductGallery images={product.images} title={product.title} />

        <div className="md:py-2">
          {product.brand && (
            <p className="text-sm uppercase tracking-wide text-ink-muted">{product.brand.name}</p>
          )}
          <h1 className="mt-1 text-2xl font-medium md:text-3xl">{product.title}</h1>

          <div className="mt-4">
            <Price cents={product.priceCents} compareAtCents={product.compareAtCents} currency={currency} size="lg" />
            <p className="mt-1 text-xs text-ink-muted">Tax included. Shipping calculated at checkout.</p>
          </div>

          <div className="mt-8">
            <AddToCart variants={variantOptions} />
          </div>

          <div className="mt-4">
            <WishlistButton productId={product.id} initial={wishlisted} authed={!!currentUser} />
          </div>

          {product.description && (
            <p className="mt-8 text-sm leading-relaxed text-ink-soft">{product.description}</p>
          )}

          <div className="mt-8">
            <Accordion
              items={[
                {
                  title: "Details",
                  content:
                    details.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5">
                        {details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Premium quality, designed for everyday wear.</p>
                    ),
                },
                {
                  title: "Size Guide",
                  content: (
                    <p>
                      Refer to the {product.brand?.name ?? "brand"} size chart for this item. If you are between sizes,
                      we recommend sizing up. Contact us for help choosing your fit.
                    </p>
                  ),
                },
                {
                  title: "Shipping & Returns",
                  content: (
                    <p>
                      Free shipping on orders over {formatMoney(1500000, currency)}. Standard delivery in 3–5 working
                      days. Easy 14-day returns — see our returns policy for details.
                    </p>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-2xl font-medium">You may also like</h2>
          <ProductGrid products={related} currency={currency} />
        </section>
      )}

      {recentlyViewed.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-medium">Recently viewed</h2>
          <ProductGrid products={recentlyViewed} currency={currency} />
        </section>
      )}
    </div>
  );
}
