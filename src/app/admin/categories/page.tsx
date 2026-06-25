import { prisma } from "@/lib/prisma";
import { CategoryManager } from "@/components/admin/CategoryManager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { slug: "asc" }, // path-based slugs → tree order
    select: { id: true, name: true, level: true, parentId: true, showInNav: true, isActive: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium">Categories</h1>
      <CategoryManager categories={categories} />
    </div>
  );
}
