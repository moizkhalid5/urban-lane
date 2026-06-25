import Link from "next/link";
import { getProductFormOptions } from "@/lib/queries/admin-options";
import { ProductEditor, type ProductEditorData } from "@/components/admin/ProductEditor";

export const dynamic = "force-dynamic";

const blank: ProductEditorData = {
  title: "",
  slug: "",
  description: "",
  details: "",
  status: "DRAFT",
  brandId: "",
  gender: "",
  productType: "",
  material: "",
  price: "",
  compareAt: "",
  cost: "",
  sku: "",
  barcode: "",
  lowStockThreshold: "5",
  isFeatured: false,
  isOutlet: false,
  tags: "",
  seoTitle: "",
  seoDescription: "",
  categoryIds: [],
  images: [],
  variants: [{ size: "", color: "", colorHex: "", sku: "", price: "", stock: "0", image: "" }],
};

export default async function NewProductPage() {
  const { brands, categories } = await getProductFormOptions();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-ink-muted hover:text-ink">← Products</Link>
        <h1 className="mt-1 text-2xl font-medium">New product</h1>
      </div>
      <ProductEditor brands={brands} categories={categories} initial={blank} />
    </div>
  );
}
