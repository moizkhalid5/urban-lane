import { prisma } from "@/lib/prisma";

export type Crumb = { name: string; slug: string; href: string };

/**
 * Ids of categories that have at least one active product, directly or in any
 * descendant. Navigation and sub-category links hide the rest so no link leads
 * to an empty page; a category reappears as soon as a product is added to it.
 */
export async function nonEmptyCategoryIds(): Promise<Set<string>> {
  const [categories, linked] = await Promise.all([
    prisma.category.findMany({ select: { id: true, parentId: true } }),
    prisma.productCategory.findMany({
      where: { product: { status: "ACTIVE" } },
      select: { categoryId: true },
      distinct: ["categoryId"],
    }),
  ]);
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
  const result = new Set<string>();
  for (const { categoryId } of linked) {
    for (let id: string | null | undefined = categoryId; id && !result.has(id); id = parentOf.get(id)) result.add(id);
  }
  return result;
}

/** Fetch a category by slug plus its ancestor chain (for breadcrumbs + headings). */
export async function getCategoryWithAncestors(slug: string) {
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) return null;

  const ancestors: Crumb[] = [];
  let current = category;
  while (current.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: current.parentId } });
    if (!parent) break;
    ancestors.unshift({ name: parent.name, slug: parent.slug, href: `/collections/${parent.slug}` });
    current = parent;
  }

  // Direct children (used to render sub-category quick links on listing pages).
  const [allChildren, nonEmpty] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: category.id, isActive: true, showInNav: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    nonEmptyCategoryIds(),
  ]);
  const children = allChildren.filter((c) => nonEmpty.has(c.id)).map(({ name, slug }) => ({ name, slug }));

  return { category, ancestors, children };
}
