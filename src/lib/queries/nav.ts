import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { nonEmptyCategoryIds } from "@/lib/queries/categories";

export type NavChild = { name: string; slug: string; href: string };
export type NavColumn = { name: string; slug: string; href: string; children: NavChild[] };
export type NavItem = {
  name: string;
  slug: string;
  href: string;
  isVirtual: boolean;
  columns: NavColumn[];
};

const collectionHref = (slug: string) => `/collections/${slug}`;

/**
 * Build the top navigation (root categories → level-1 columns → level-2 links)
 * plus a synthetic "Brands" entry. Sub-categories without products are left out.
 * Cached and revalidated by tag "nav".
 */
export const getNavTree = unstable_cache(
  async (): Promise<NavItem[]> => {
    const nonEmpty = await nonEmptyCategoryIds();
    const roots = await prisma.category.findMany({
      where: { level: 0, showInNav: true, isActive: true },
      orderBy: { position: "asc" },
      include: {
        children: {
          where: { showInNav: true, isActive: true },
          orderBy: { position: "asc" },
          include: {
            children: {
              where: { showInNav: true, isActive: true },
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });

    const items: NavItem[] = roots.map((root) => ({
      name: root.name,
      slug: root.slug,
      href: collectionHref(root.slug),
      isVirtual: root.isVirtual,
      columns: root.children
        .filter((col) => nonEmpty.has(col.id))
        .map((col) => ({
          name: col.name,
          slug: col.slug,
          href: collectionHref(col.slug),
          children: col.children
            .filter((leaf) => nonEmpty.has(leaf.id))
            .map((leaf) => ({
              name: leaf.name,
              slug: leaf.slug,
              href: collectionHref(leaf.slug),
            })),
        })),
    }));

    // Synthetic "Brands" nav entry (links to the all-brands page).
    items.push({ name: "Brands", slug: "brands", href: "/brands", isVirtual: false, columns: [] });
    return items;
  },
  ["nav-tree"],
  { tags: ["nav"], revalidate: 3600 },
);
