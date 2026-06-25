import { prisma } from "@/lib/prisma";

export type Crumb = { name: string; slug: string; href: string };

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
  const children = await prisma.category.findMany({
    where: { parentId: category.id, isActive: true, showInNav: true },
    orderBy: { position: "asc" },
    select: { name: true, slug: true },
  });

  return { category, ancestors, children };
}
