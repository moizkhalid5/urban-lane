import { prisma } from "@/lib/prisma";

/**
 * Homepage "Featured" rows (components/home/FeaturedSplit.tsx). Admin → Homepage featured picks the products
 * for each row; a row with none picked shows the department's featured products automatically. The table is
 * created on first use, because the host's deploy doesn't run migrations. Same SQL as
 * prisma/migrations/20261028120000_featured_picks.
 */
const CREATE_PICK = `CREATE TABLE IF NOT EXISTS \`FeaturedPick\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`department\` VARCHAR(20) NOT NULL,
    \`productId\` VARCHAR(191) NOT NULL,
    \`position\` INTEGER NOT NULL DEFAULT 0,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`FeaturedPick_department_productId_key\`(\`department\`, \`productId\`),
    INDEX \`FeaturedPick_department_position_idx\`(\`department\`, \`position\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`FeaturedPick_productId_fkey\` FOREIGN KEY (\`productId\`) REFERENCES \`Product\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

/** The rows, in order (slug = the department's collection). */
export const FEATURED_DEPARTMENTS = [
  { slug: "men", title: "Men's" },
  { slug: "women", title: "Women's" },
  { slug: "kids", title: "Kids'" },
] as const;

export type FeaturedDepartmentSlug = (typeof FEATURED_DEPARTMENTS)[number]["slug"];

export const isFeaturedDepartment = (v: string): v is FeaturedDepartmentSlug => FEATURED_DEPARTMENTS.some((d) => d.slug === v);

/** Most products a row can hold. */
export const MAX_FEATURED_PICKS = 12;

let ready: Promise<void> | null = null;
export function ensureFeaturedTables(): Promise<void> {
  ready ??= prisma.$executeRawUnsafe(CREATE_PICK).then(
    () => undefined,
    (err) => {
      ready = null;
      throw err;
    },
  );
  return ready;
}

/** Picked product ids per department, in order. Empty (never throws) if the table can't be read. */
export async function getFeaturedPickIds(): Promise<Record<string, string[]>> {
  try {
    await ensureFeaturedTables();
    const picks = await prisma.featuredPick.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { department: true, productId: true } });
    const out: Record<string, string[]> = {};
    for (const p of picks) (out[p.department] ??= []).push(p.productId);
    return out;
  } catch (err) {
    console.error("[featured] Couldn't read the picked products.", err);
    return {};
  }
}
