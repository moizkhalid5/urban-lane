/**
 * Links every product to its sub-categories (Women → Dresses, Men → Trousers → Chinos, …)
 * using the title rules in src/lib/category-rules.ts. Imports only set the department,
 * which left every sub-category page in the navigation empty.
 *
 * Also creates the two categories the catalogue needs but the original tree lacked
 * (Women → Tops, Men → Coats and Jackets). Only adds links; never removes any. Safe to re-run.
 *
 *   npx tsx prisma/backfill-subcategories.ts           # preview
 *   npx tsx prisma/backfill-subcategories.ts --apply   # write
 */
import { PrismaClient } from "@prisma/client";
import { subcategoriesFor } from "../src/lib/category-rules";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const NEW_CATEGORIES = [
  { parent: "women", name: "Tops", slug: "women-tops" },
  { parent: "men", name: "Coats and Jackets", slug: "men-coats-and-jackets" },
];

async function ensureCategories() {
  for (const c of NEW_CATEGORIES) {
    if (await prisma.category.findUnique({ where: { slug: c.slug } })) continue;
    const parent = await prisma.category.findUniqueOrThrow({ where: { slug: c.parent }, include: { children: true } });
    console.log(`${apply ? "Creating" : "Would create"} category ${c.slug}`);
    if (apply) {
      await prisma.category.create({
        data: { name: c.name, slug: c.slug, parentId: parent.id, level: 1, position: parent.children.length },
      });
    }
  }
}

async function main() {
  await ensureCategories();
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      categories: { select: { category: { select: { slug: true, level: true, isVirtual: true } } } },
      variants: { select: { size: true } },
    },
  });

  const links: { productId: string; categoryId: string }[] = [];
  const counts = new Map<string, number>();
  const unmatched: string[] = [];

  for (const p of products) {
    const departments = p.categories.filter((c) => c.category.level === 0 && !c.category.isVirtual).map((c) => c.category.slug);
    const sizes = p.variants.map((v) => v.size).filter((s): s is string => !!s);
    const slugs = [...new Set(departments.flatMap((d) => subcategoriesFor(p.title, d, sizes)))];
    if (slugs.length === 0) unmatched.push(`[${departments.join(",")}] ${p.title}`);
    for (const slug of slugs) {
      const categoryId = idBySlug.get(slug) ?? (NEW_CATEGORIES.some((c) => c.slug === slug) && !apply ? "pending" : undefined);
      if (!categoryId) throw new Error(`Rule produced unknown category "${slug}" for "${p.title}"`);
      links.push({ productId: p.id, categoryId });
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }

  console.log(`\n${products.length} products → ${links.length} sub-category links; ${unmatched.length} stay at department level only.\n`);
  for (const [slug, n] of [...counts.entries()].sort()) console.log(`  ${String(n).padStart(3)}  ${slug}`);
  if (unmatched.length) console.log(`\nDepartment only:\n  ${unmatched.sort().join("\n  ")}`);

  if (apply) {
    const res = await prisma.productCategory.createMany({ data: links, skipDuplicates: true });
    console.log(`\n✅ Added ${res.count} links.`);
  } else {
    console.log("\nPreview only. Re-run with --apply to write.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
