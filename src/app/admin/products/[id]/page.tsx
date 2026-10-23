import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProductFormOptions } from "@/lib/queries/admin-options";
import { ProductEditor, type ProductEditorData } from "@/components/admin/ProductEditor";
import { SalesHistoryForm } from "@/components/admin/SalesHistoryForm";
import { ProductReviewsPanel } from "@/components/admin/ProductReviewsPanel";
import { UkPriceForm } from "@/components/admin/UkPriceForm";
import { ensurePricingTables, getGbpToPkr } from "@/lib/pricing/uk-price";
import { ensureReviewTables, getReviewSettings } from "@/lib/reviews/db";

export const dynamic = "force-dynamic";

const major = (cents: number | null | undefined) => (cents == null ? "" : String(cents / 100));

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, options] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: "asc" } },
        variants: { orderBy: { position: "asc" } },
        categories: { select: { categoryId: true } },
      },
    }),
    getProductFormOptions(),
  ]);
  if (!product) notFound();

  const [priorSales, reviewSettings, ukPrice, gbpToPkr] = await Promise.all([
    ensureReviewTables()
      .then(() => prisma.priorSales.findUnique({ where: { productId: product.id } }))
      .catch(() => null),
    getReviewSettings(),
    ensurePricingTables()
      .then(() => prisma.ukPrice.findUnique({ where: { productId: product.id } }))
      .catch(() => null),
    getGbpToPkr(),
  ]);

  const initial: ProductEditorData = {
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description ?? "",
    details: product.details ?? "",
    status: product.status,
    brandId: product.brandId ?? "",
    gender: product.gender ?? "",
    productType: product.productType ?? "",
    material: product.material ?? "",
    price: major(product.priceCents),
    compareAt: major(product.compareAtCents),
    cost: major(product.costCents),
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    lowStockThreshold: String(product.lowStockThreshold),
    isFeatured: product.isFeatured,
    isOutlet: product.isOutlet,
    tags: (Array.isArray(product.tags) ? (product.tags as string[]) : []).join(", "),
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    categoryIds: product.categories.map((c) => c.categoryId),
    images: product.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })),
    variants: product.variants.map((v) => ({
      id: v.id,
      size: v.size ?? "",
      color: v.color ?? "",
      colorHex: v.colorHex ?? "",
      sku: v.sku ?? "",
      price: major(v.priceCents),
      stock: String(v.stock),
      image: v.image ?? "",
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-ink-muted hover:text-ink">← Products</Link>
        <h1 className="mt-1 text-2xl font-medium">Edit product</h1>
      </div>
      <ProductEditor brands={options.brands} categories={options.categories} initial={initial} />
      <SalesHistoryForm
        productId={product.id}
        websiteSales={product.salesCount}
        initialUnits={priorSales?.units ?? 0}
        initialNote={priorSales?.note ?? ""}
        minSoldToShow={reviewSettings.minSoldToShow}
      />
      <UkPriceForm
        productId={product.id}
        ourPrice={product.priceCents / 100}
        initialPounds={ukPrice ? String(ukPrice.pence / 100) : ""}
        initialSource={ukPrice?.source ?? ""}
        gbpToPkr={gbpToPkr}
      />
      <ProductReviewsPanel productId={product.id} />
    </div>
  );
}
