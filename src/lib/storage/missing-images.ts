import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { LEGACY_UPLOAD_DIR, UPLOAD_READ_DIRS } from "./index";
import { keysInDatabase } from "./db-files";

export type ProductWithMissingImages = { id: string; title: string; slug: string; missing: number; total: number };

async function existsOnDisk(dirs: string[], key: string): Promise<boolean> {
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
 * Products whose photos point at an uploaded file that no longer exists (shown as an empty grey frame
 * on the shop). Used by the admin dashboard so lost photos are spotted and re-uploaded.
 */
export async function findProductsWithMissingImages(): Promise<ProductWithMissingImages[]> {
  const images = await prisma.productImage.findMany({
    where: { url: { startsWith: "/uploads/" } },
    select: { url: true, product: { select: { id: true, title: true, slug: true } } },
  });
  const keys = images.map((i) => i.url.slice("/uploads/".length).split("?")[0]);
  const inDb = await keysInDatabase(keys.filter((k) => !k.includes("/"))).catch(() => new Set<string>());

  const byProduct = new Map<string, ProductWithMissingImages>();
  await Promise.all(
    images.map(async (img, i) => {
      const key = keys[i];
      // Catalogue photos (products/<sku>/n.png) ship with the code; uploads may be in the database.
      const ok = key.includes("/") ? await existsOnDisk([LEGACY_UPLOAD_DIR], key) : inDb.has(key) || (await existsOnDisk(UPLOAD_READ_DIRS, key));
      const entry = byProduct.get(img.product.id) ?? { ...img.product, missing: 0, total: 0 };
      entry.total += 1;
      if (!ok) entry.missing += 1;
      byProduct.set(img.product.id, entry);
    }),
  );
  return [...byProduct.values()].filter((p) => p.missing > 0).sort((a, b) => a.title.localeCompare(b.title));
}
