import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { uploadReadDirs } from "./index";

export type ProductWithMissingImages = { id: string; title: string; slug: string; missing: number; total: number };

async function exists(dirs: string[], key: string): Promise<boolean> {
  for (const dir of dirs) {
    const root = path.resolve(dir);
    const file = path.resolve(root, key);
    if (!file.startsWith(root + path.sep)) continue;
    try {
      await fs.access(file);
      return true;
    } catch {}
  }
  return false;
}

/**
 * Products whose photos point at a file that isn't in the photos folder (UPLOAD_DIR) or shipped with the
 * code, shown as an empty grey frame on the shop. Used by the admin dashboard so they're re-uploaded.
 */
export async function findProductsWithMissingImages(): Promise<ProductWithMissingImages[]> {
  const images = await prisma.productImage.findMany({
    where: { url: { startsWith: "/uploads/" } },
    select: { url: true, product: { select: { id: true, title: true, slug: true } } },
  });
  const dirs = uploadReadDirs();
  const byProduct = new Map<string, ProductWithMissingImages>();
  await Promise.all(
    images.map(async (img) => {
      const ok = await exists(dirs, img.url.slice("/uploads/".length).split("?")[0]);
      const entry = byProduct.get(img.product.id) ?? { ...img.product, missing: 0, total: 0 };
      entry.total += 1;
      if (!ok) entry.missing += 1;
      byProduct.set(img.product.id, entry);
    }),
  );
  return [...byProduct.values()].filter((p) => p.missing > 0).sort((a, b) => a.title.localeCompare(b.title));
}
