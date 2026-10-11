/**
 * Additive catalogue import (Sept 2026 image drop).
 *
 * Reads prisma/import-additions.json (produced by scripts/build_import_additions.py):
 *   - products:         created only if their SKU is not already in the database
 *   - variantAdditions: missing sizes added to products that are already live
 * Never deletes anything, so live products, admin edits and orders are untouched.
 * Safe to re-run.
 *
 * Run:  npx tsx prisma/import-additions.ts [file]   (default prisma/import-additions.json)
 */
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { slugify } from "../src/lib/slug";
import { subcategoriesFor } from "../src/lib/category-rules";

const prisma = new PrismaClient();

type ImportVariant = { size: string | null; color: string | null; stock: number };
type ImportProduct = {
  sku: string;
  title: string;
  description: string | null;
  brand: string;
  categories: string[]; // top-level slugs; first one sets gender
  priceCents: number;
  variants: ImportVariant[];
  images: string[];
};
type VariantAddition = { sku: string; variants: ImportVariant[] };
type AdditionsFile = { products: ImportProduct[]; variantAdditions: VariantAddition[] };

const variantLabel = (v: ImportVariant) => [v.size, v.color].filter(Boolean).join(" / ") || null;
const variantKey = (size: string | null, color: string | null) => `${(size ?? "").toLowerCase()}|${(color ?? "").toLowerCase()}`;

/** Department links from the file plus sub-categories from the title rules (Women → Dresses, …). */
function categoryLinks(p: ImportProduct, departments: Map<string, string>, all: Map<string, string>) {
  const sizes = p.variants.map((v) => v.size).filter((s): s is string => !!s);
  const subs = p.categories.flatMap((d) => subcategoriesFor(p.title, d, sizes));
  const ids = [...p.categories.map((c) => departments.get(c)!), ...subs.map((s) => all.get(s)).filter((id): id is string => !!id)];
  return [...new Set(ids)].map((categoryId) => ({ categoryId }));
}

async function createProducts(data: ImportProduct[]) {
  const live = new Set(
    (await prisma.product.findMany({ where: { sku: { in: data.map((d) => d.sku) } }, select: { sku: true } })).map(
      (p) => p.sku,
    ),
  );
  const todo = data.filter((d) => !live.has(d.sku));
  console.log(`Products: ${data.length} in file, ${live.size} already in DB (skipped), ${todo.length} to create.`);

  const cats = await prisma.category.findMany({ select: { id: true, slug: true, level: true } });
  const catBySlug = new Map(cats.filter((c) => c.level === 0).map((c) => [c.slug, c.id]));
  const anyCatBySlug = new Map(cats.map((c) => [c.slug, c.id]));
  for (const slug of new Set(todo.flatMap((d) => d.categories))) {
    if (!catBySlug.has(slug)) throw new Error(`Top-level category not found: ${slug}. Run the seed first.`);
  }

  // Upsert brands (slug match reuses existing brands, e.g. "Gap" -> GAP).
  const brandByName = new Map<string, string>();
  for (const name of new Set(todo.map((d) => d.brand))) {
    const brand = await prisma.brand.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) } });
    brandByName.set(name, brand.id);
  }

  const takenSlugs = new Set((await prisma.product.findMany({ select: { slug: true } })).map((p) => p.slug));
  for (const p of todo) {
    let slug = `${slugify(p.title)}-${slugify(p.sku)}`.slice(0, 90);
    for (let n = 2; takenSlugs.has(slug); n++) slug = `${slug.slice(0, 86)}-${n}`;
    takenSlugs.add(slug);

    const primary = p.categories[0];
    const gender =
      p.categories.length > 1 ? null : primary === "men" ? "Men" : primary === "women" ? "Women" : primary === "kids" ? "Kids" : null;

    const variants: Prisma.ProductVariantCreateWithoutProductInput[] = p.variants.map((v, i) => ({
      label: variantLabel(v),
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
        categories: { create: categoryLinks(p, catBySlug, anyCatBySlug) },
        images: { create: p.images.map((url, i) => ({ url, alt: p.title, position: i })) },
        variants: { create: variants.length ? variants : [{ stock: 0, position: 0 }] },
      },
    });
  }
  return todo.length;
}

async function addVariants(additions: VariantAddition[]) {
  let added = 0;
  for (const a of additions) {
    const product = await prisma.product.findFirst({ where: { sku: a.sku }, include: { variants: true } });
    if (!product) {
      console.warn(`  ! ${a.sku}: not in DB, sizes skipped`);
      continue;
    }
    const have = new Set(product.variants.map((v) => variantKey(v.size, v.color)));
    let position = Math.max(-1, ...product.variants.map((v) => v.position)) + 1;
    for (const v of a.variants) {
      if (have.has(variantKey(v.size, v.color))) continue;
      await prisma.productVariant.create({
        data: { productId: product.id, label: variantLabel(v), size: v.size, color: v.color, stock: v.stock, position: position++ },
      });
      have.add(variantKey(v.size, v.color));
      added += 1;
    }
  }
  return added;
}

async function main() {
  const path = process.argv[2] ?? join("prisma", "import-additions.json");
  console.log(`Reading ${path}`);
  const raw = JSON.parse(readFileSync(join(process.cwd(), path), "utf-8"));
  const file: AdditionsFile = Array.isArray(raw) ? { products: raw, variantAdditions: [] } : raw;

  const created = await createProducts(file.products);
  const sizes = await addVariants(file.variantAdditions ?? []);

  console.log(`\n✅ Created ${created} products, added ${sizes} sizes to existing products.`);
  console.log(
    `DB now has: ${await prisma.product.count()} products, ${await prisma.productVariant.count()} variants, ${await prisma.productImage.count()} images.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
