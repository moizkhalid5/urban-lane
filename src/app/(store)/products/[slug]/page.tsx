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
import { breadcrumbLd, productLd } from "@/lib/seo/structured-data";
import { productMetadata } from "@/lib/seo/meta";
import { getSiteSettings } from "@/lib/settings";
import { TrackRecentlyViewed } from "@/components/product/TrackRecentlyViewed";
import { WishlistButton } from "@/components/product/WishlistButton";
import { isWishlisted } from "@/lib/wishlist";
import { getProductReviews } from "@/lib/reviews/queries";
import { ProductReviews } from "@/components/reviews/ProductReviews";
import { Stars } from "@/components/reviews/Stars";
import { ukComparisonsFor } from "@/lib/pricing/uk-price";
import { UkFlag } from "@/components/ui/UkFlag";
import { TrackEvent } from "@/components/analytics/TrackEvent";
import { rupees, type AnalyticsItem } from "@/lib/analytics/track";
import { ColourSelectionProvider } from "@/components/product/ColourSelection";
import { getBundleConfig } from "@/lib/bundles";
import { colourKey } from "@/lib/bundle-rule";

type PageProps = { params: Promise<{ slug: string }> };


/**
 * "Next Teal Dress Price in Pakistan | Urban Lane" with a description that sells: price (and saving), sizes
 * in stock, cash on delivery and free delivery (lib/seo/meta.ts). A title or description set in the admin wins.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return productMetadata(product, await getSiteSettings());
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const currency = await getActiveCurrency();
  // The most specific category (e.g. Men › Tops › Shirts › Formal rather than just Men): a precise breadcrumb
  // trail, related products and search title.
  const primaryCategory = product.categories
    .map((c) => c.category)
    .filter((c) => !c.isVirtual)
    .sort((a, b) => b.level - a.level)[0];
  const catData = primaryCategory ? await getCategoryWithAncestors(primaryCategory.slug) : null;

  const crumbs = [
    ...(catData ? catData.ancestors : []),
    ...(primaryCategory ? [{ name: primaryCategory.name, href: `/collections/${primaryCategory.slug}` }] : []),
    { name: product.title, href: `/products/${product.slug}` },
  ];

  const [related, reviews, ukPrices, bundleConfig, settings] = await Promise.all([
    getRelatedProducts(product.id, primaryCategory?.id, 4),
    getProductReviews(product.id, product.salesCount),
    ukComparisonsFor([product]),
    getBundleConfig(),
    getSiteSettings(),
  ]);
  const ukPrice = ukPrices.get(product.id);

  // Recently viewed (cookie set client-side on previous views; excludes current product).
  const recentIds = (await cookies()).get("ul_recent")?.value?.split(",").filter(Boolean) ?? [];
  const recentlyViewed = await getProductsByIds(recentIds.filter((id) => id !== product.id).slice(0, 4));

  const variantOptions = product.variants.map((v) => ({
    id: v.id,
    size: v.size,
    color: v.color,
    colorHex: v.colorHex,
    stock: v.stock,
    priceCents: v.priceCents,
  }));

  // Colours: the photo of each (Admin → Products → Variants), and whether enough are in stock for a bundle.
  const colourNames = [...new Set(product.variants.map((v) => v.color).filter((c): c is string => !!c?.trim()))];
  const colourPhotos = colourNames.flatMap((colour) => {
    const url = product.variants.find((v) => v.color === colour && v.image)?.image;
    if (!url) return [];
    const own = product.images.find((img) => img.url === url);
    return [{ colour, photo: { url, alt: own?.alt ?? `${product.title} in ${colour}` } }];
  });
  const coloursInStock = new Set(product.variants.filter((v) => v.color?.trim() && v.stock > 0).map((v) => colourKey(v.color!)));
  const bundleOffer =
    bundleConfig.enabled && coloursInStock.size >= bundleConfig.minColours
      ? { config: bundleConfig, productPriceCents: product.priceCents, currency }
      : undefined;

  const wishlisted = await isWishlisted(product.id);

  // Google merchant listing + breadcrumb trail (lib/seo/structured-data.ts). Real (non-sample) approved reviews only.
  const jsonLd = productLd(product, settings, reviews.realSummary);
  const crumbsLd = breadcrumbLd([{ name: "Home", href: "/" }, ...crumbs]);

  const details = (product.details ?? "").split("\n").filter(Boolean);
  const analyticsItem: AnalyticsItem = {
    item_id: product.id,
    item_name: product.title,
    ...(product.brand && { item_brand: product.brand.name }),
    ...(primaryCategory && { item_category: primaryCategory.name }),
    price: rupees(product.priceCents),
    ...(product.compareAtCents && product.compareAtCents > product.priceCents && { discount: rupees(product.compareAtCents - product.priceCents) }),
  };

  return (
    <div className="container-site py-8">
      <JsonLd data={jsonLd} />
      <JsonLd data={crumbsLd} />
      <TrackRecentlyViewed productId={product.id} />
      <TrackEvent event="view_item" items={[analyticsItem]} />

      {/* Computers only: on phones the trail took a row above the photo for little use (the menu and the
          back button do that job); search engines still get it from the BreadcrumbList data above. */}
      <div className="hidden md:block">
        <Breadcrumbs items={crumbs} />
      </div>

      {/* grid-cols-1 caps the phone column at the screen width (minmax(0,1fr)); without it the
          gallery's thumbnail strip widened the page and phones zoomed the whole page out. */}
      <ColourSelectionProvider initial={colourNames.length === 1 ? colourNames[0] : null}>
        {/* Photo a little wider than the details, like a square photo beside a column of text */}
        <div className="grid grid-cols-1 gap-10 md:mt-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
          <ProductGallery images={product.images} title={product.title} colourPhotos={colourPhotos} />

          <div className="md:py-2">
            {product.brand && (
              <p className="text-sm uppercase tracking-wide text-ink-muted">{product.brand.name}</p>
            )}
            <h1 className="mt-1 text-2xl font-medium md:text-3xl">{product.title}</h1>

            {(reviews.showStars || reviews.sold) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
                {reviews.showStars && (
                  <a href="#reviews" className="flex items-center gap-2 hover:text-ink">
                    <Stars value={reviews.summary.average} size={16} />
                    <span>
                      {reviews.summary.average.toFixed(1)} ({reviews.summary.count}{" "}
                      {reviews.summary.count === 1 ? "review" : "reviews"})
                    </span>
                  </a>
                )}
                {reviews.showStars && reviews.sold && <span aria-hidden>·</span>}
                {reviews.sold && <span>{reviews.sold} sold</span>}
              </div>
            )}

            <div className="mt-4">
              <Price
                cents={product.priceCents}
                compareAtCents={product.compareAtCents}
                uk={ukPrice}
                currency={currency}
                size="lg"
              />
              {ukPrice && !(product.compareAtCents && product.compareAtCents > product.priceCents) && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                  <UkFlag /> Crossed-out price: this item&apos;s retail price in the UK, converted to rupees.
                </p>
              )}
              <p className="mt-1 text-xs text-ink-muted">Tax included. Shipping calculated at checkout.</p>
            </div>

            <div className="mt-8">
              <AddToCart variants={variantOptions} analyticsItem={analyticsItem} bundle={bundleOffer} />
            </div>

            <div className="mt-4">
              <WishlistButton productId={product.id} initial={wishlisted} analyticsItem={analyticsItem} />
            </div>

            {/* The description in paragraphs (blank lines), keeping single line breaks; a "Product Details"
                heading copied from a brand site is left out. */}
            {product.description?.trim() && (
              <div className="mt-8 space-y-3 text-sm leading-relaxed text-ink-soft">
                {product.description
                  .replace(/\r\n?/g, "\n")
                  .replace(/^\s*product details\s*:?\s*\n/i, "")
                  .split(/\n\s*\n/)
                  .map((para) => para.trim())
                  .filter(Boolean)
                  .map((para, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {para}
                    </p>
                  ))}
              </div>
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
                        days. Free returns within 14 days — see our returns policy for details.
                      </p>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </ColourSelectionProvider>

      <ProductReviews productId={product.id} data={reviews} />

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
