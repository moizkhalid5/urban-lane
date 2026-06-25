import { prisma } from "@/lib/prisma";

/** Brands + assignable categories (tree-ordered, excludes virtual) for admin selects. */
export async function getProductFormOptions() {
  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.category.findMany({
      where: { isVirtual: false },
      orderBy: { slug: "asc" }, // path-based slugs sort into tree order
      select: { id: true, name: true, level: true },
    }),
  ]);
  return { brands, categories };
}
