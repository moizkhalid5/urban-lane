/**
 * Stage 2 of the catalogue import.
 *
 * Reads prisma/import-data.json (produced by scripts/build_import.py), removes
 * the existing (demo) products, upserts brands, and creates the real products
 * with variants, images and a top-level category link.
 *
 * Run:  npx tsx prisma/import-products.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { slugify } from "../src/lib/slug";

const prisma = new PrismaClient();

type ImportProduct = {
  sku: string;
  title: string;
  description: string | null;
  brand: string;
  category: string; // top-level slug
  priceCents: number;
  variants: { size: string | null; color: string | null; stock: number }[];
  images: string[];
};

async function main() {
  const data: ImportProduct[] = JSON.parse(
    readFileSync(join(process.cwd(), "prisma", "import-data.json"), "utf-8"),
  );
  console.log(`Importing ${data.length} products…`);

  // 1. Resolve top-level categories by slug.
  const cats = await prisma.category.findMany({ where: { level: 0 }, select: { id: true, slug: true } });
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]));
  for (const slug of new Set(data.map((d) => d.category))) {
    if (!catBySlug.has(slug)) throw new Error(`Top-level category not found: ${slug}. Run the seed first.`);
  }

  // 2. Upsert brands.
  const brandNames = [...new Set(data.map((d) => d.brand))];
  const brandByName = new Map<string, string>();
  for (const name of brandNames) {
    const slug = slugify(name);
    const brand = await prisma.brand.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    brandByName.set(name, brand.id);
  }
  console.log(`Brands ready: ${brandByName.size}`);

  // 3. Remove existing (demo) products. Order snapshots are preserved (OrderItem = SetNull).
  const removed = await prisma.product.deleteMany({});
  console.log(`Removed ${removed.count} existing products.`);

  // 4. Create products.
  let created = 0;
  for (const p of data) {
    const slug = `${slugify(p.title)}-${slugify(p.sku)}`.slice(0, 90);
    const gender =
      p.category === "men" ? "Men" : p.category === "women" ? "Women" : p.category === "kids" ? "Kids" : null;

    const variants: Prisma.ProductVariantCreateWithoutProductInput[] = p.variants.map((v, i) => ({
      label: [v.size, v.color].filter(Boolean).join(" / ") || null,
      size: v.size,
      color: v.color,
      stock: v.stock,
      position: i,
    }));

    await prisma.product.create({
      data: {
        title: p.title,
        slug,
        description: p.description,
        sku: p.sku,
        status: "ACTIVE",
        publishedAt: new Date(),
        priceCents: p.priceCents,
        gender,
        brandId: brandByName.get(p.brand)!,
        categories: { create: [{ categoryId: catBySlug.get(p.category)! }] },
        images: { create: p.images.map((url, i) => ({ url, alt: p.title, position: i })) },
        variants: { create: variants.length ? variants : [{ stock: 0, position: 0 }] },
      },
    });
    created += 1;
  }

  console.log(`\n✅ Imported ${created} products.`);
  const totals = await prisma.product.aggregate({ _count: true });
  const variantCount = await prisma.productVariant.count();
  const imageCount = await prisma.productImage.count();
  console.log(`DB now has: ${totals._count} products, ${variantCount} variants, ${imageCount} images.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
