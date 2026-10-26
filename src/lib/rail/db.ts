import { prisma } from "@/lib/prisma";

/**
 * Homepage "hanging rail" (Admin → Homepage rail). The tables are created on first use, because the host's
 * deploy doesn't run migrations. Same SQL as prisma/migrations/20261026120000_hanging_rail.
 */
const CREATE_COLLECTION = `CREATE TABLE IF NOT EXISTS \`RailCollection\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(60) NOT NULL,
    \`position\` INTEGER NOT NULL DEFAULT 0,
    \`isActive\` BOOLEAN NOT NULL DEFAULT true,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

const CREATE_ITEM = `CREATE TABLE IF NOT EXISTS \`RailItem\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`productId\` VARCHAR(191) NULL,
    \`collectionId\` VARCHAR(191) NULL,
    \`frontImage\` VARCHAR(500) NOT NULL,
    \`sideImage\` VARCHAR(500) NOT NULL,
    \`word\` VARCHAR(20) NULL,
    \`position\` INTEGER NOT NULL DEFAULT 0,
    \`isActive\` BOOLEAN NOT NULL DEFAULT true,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    INDEX \`RailItem_isActive_position_idx\`(\`isActive\`, \`position\`),
    INDEX \`RailItem_collectionId_idx\`(\`collectionId\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`RailItem_productId_fkey\` FOREIGN KEY (\`productId\`) REFERENCES \`Product\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT \`RailItem_collectionId_fkey\` FOREIGN KEY (\`collectionId\`) REFERENCES \`RailCollection\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

/** For a RailItem table created before collections existed. */
const ADD_COLLECTION_COLUMN = [
  "ALTER TABLE `RailItem` ADD COLUMN `collectionId` VARCHAR(191) NULL AFTER `productId`",
  "ALTER TABLE `RailItem` ADD INDEX `RailItem_collectionId_idx`(`collectionId`)",
  "ALTER TABLE `RailItem` ADD CONSTRAINT `RailItem_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `RailCollection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE",
];

const CREATE_SETTINGS = `CREATE TABLE IF NOT EXISTS \`RailSettings\` (
    \`id\` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    \`enabled\` BOOLEAN NOT NULL DEFAULT true,
    \`placement\` VARCHAR(40) NOT NULL DEFAULT 'after-hero',
    \`heading\` VARCHAR(80) NULL,
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

/** The collections the rail starts with; rename, reorder, hide or add more in Admin → Homepage rail. */
export const DEFAULT_RAIL_COLLECTIONS = [
  "Men's Suits",
  "Women's Winter Jackets",
  "Men's Winter Jackets",
  "Women's Dresses",
  "Men's Shirts",
  "Kids' Suits",
];

let ready: Promise<void> | null = null;
export function ensureRailTables(): Promise<void> {
  ready ??= (async () => {
    await prisma.$executeRawUnsafe(CREATE_COLLECTION);
    await prisma.$executeRawUnsafe(CREATE_ITEM);
    await prisma.$executeRawUnsafe(CREATE_SETTINGS);
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RailItem' AND COLUMN_NAME = 'collectionId'",
    );
    if (Number(n) === 0) for (const sql of ADD_COLLECTION_COLUMN) await prisma.$executeRawUnsafe(sql);
    if ((await prisma.railCollection.count()) === 0) {
      await prisma.railCollection.createMany({ data: DEFAULT_RAIL_COLLECTIONS.map((name, position) => ({ name, position })) });
    }
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

/** Where the rail can go on the homepage (src/app/(store)/page.tsx). */
export const RAIL_PLACEMENTS = [
  { key: "after-hero", label: "Before “Shop by category” (after the banner slider)" },
  { key: "after-brands", label: "After “Shop by brand”" },
  { key: "after-featured", label: "After “Featured” (before the Winter banner)" },
  { key: "after-new", label: "After “New arrivals”" },
] as const;
export type RailPlacement = (typeof RAIL_PLACEMENTS)[number]["key"];

export type RailSettingsData = { enabled: boolean; placement: RailPlacement; heading: string };
export const DEFAULT_RAIL_SETTINGS: RailSettingsData = { enabled: true, placement: "after-hero", heading: "" };

export function isPlacement(v: string): v is RailPlacement {
  return RAIL_PLACEMENTS.some((p) => p.key === v);
}

export async function getRailSettings(): Promise<RailSettingsData> {
  try {
    await ensureRailTables();
    const row = await prisma.railSettings.findUnique({ where: { id: "singleton" } });
    if (!row) return DEFAULT_RAIL_SETTINGS;
    return { enabled: row.enabled, placement: isPlacement(row.placement) ? row.placement : "after-hero", heading: row.heading ?? "" };
  } catch (err) {
    console.error("[rail] Couldn't read the rail settings; using defaults.", err);
    return DEFAULT_RAIL_SETTINGS;
  }
}

export { railWord } from "./word";
