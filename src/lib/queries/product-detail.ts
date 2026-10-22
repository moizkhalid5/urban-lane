import { prisma } from "@/lib/prisma";
import { toCardList } from "@/lib/queries/to-card";
import { withRatings } from "@/lib/reviews/queries";

/** Full product for the PDP, including variants, images, brand and primary category. */
export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      brand: true,
      images: { orderBy: { position: "asc" } },
      variants: { where: { isActive: true }, orderBy: { position: "asc" } },
      categories: { include: { category: true } },
    },
  });
}

/** Related products: same primary category, excluding the current product. */
export async function getRelatedProducts(productId: string, categoryId: string | undefined, take = 4) {
  if (!categoryId) return [];
  const rows = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      id: { not: productId },
      categories: { some: { categoryId } },
    },
    include: {
      brand: { select: { name: true } },
      images: { orderBy: { position: "asc" }, take: 2 },
      variants: { where: { isActive: true }, select: { color: true, colorHex: true, stock: true } },
    },
    take,
    orderBy: { salesCount: "desc" },
  });
  return withRatings(toCardList(rows));
}

/** Fetch product cards by id (used by the "recently viewed" client list). */
export async function getProductsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    include: {
      brand: { select: { name: true } },
      images: { orderBy: { position: "asc" }, take: 2 },
      variants: { where: { isActive: true }, select: { color: true, colorHex: true, stock: true } },
    },
  });
  // Preserve incoming id order.
  const map = new Map(rows.map((r) => [r.id, r]));
  return withRatings(toCardList(ids.map((id) => map.get(id)).filter(Boolean) as typeof rows));
}
