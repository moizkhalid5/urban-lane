import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

/** Generate a unique product slug, appending -2, -3… on collision. */
export async function uniqueProductSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "product";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}
