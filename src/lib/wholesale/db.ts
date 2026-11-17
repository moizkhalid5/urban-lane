import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Tables for Admin → Wholesale, created on first use because the host's deploy doesn't run migrations.
 * Same SQL as prisma/migrations/20261118120000_wholesale (the foreign key is inside CREATE TABLE here so
 * it can run more than once).
 */
export const WHOLESALE_TABLES = [
  `CREATE TABLE IF NOT EXISTS \`WholesaleProspect\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`ref\` INTEGER NULL,
    \`name\` VARCHAR(200) NOT NULL,
    \`website\` VARCHAR(300) NULL,
    \`segments\` VARCHAR(300) NULL,
    \`stockType\` VARCHAR(120) NULL,
    \`shopType\` VARCHAR(60) NULL,
    \`city\` VARCHAR(120) NULL,
    \`address\` VARCHAR(500) NULL,
    \`phone\` VARCHAR(60) NULL,
    \`whatsapp\` VARCHAR(200) NULL,
    \`email\` VARCHAR(320) NULL,
    \`instagram\` VARCHAR(300) NULL,
    \`facebook\` VARCHAR(300) NULL,
    \`tiktok\` VARCHAR(300) NULL,
    \`otherContacts\` TEXT NULL,
    \`ourBrands\` TEXT NULL,
    \`brandsInCommon\` INTEGER NOT NULL DEFAULT 0,
    \`unitsInBrands\` INTEGER NOT NULL DEFAULT 0,
    \`priority\` VARCHAR(20) NOT NULL DEFAULT 'Medium',
    \`pitchAngle\` VARCHAR(120) NULL,
    \`stockToOffer\` TEXT NULL,
    \`pitch\` TEXT NULL,
    \`theirBrands\` TEXT NULL,
    \`whatTheySell\` TEXT NULL,
    \`notes\` TEXT NULL,
    \`caution\` TEXT NULL,
    \`evidence\` TEXT NULL,
    \`stage\` VARCHAR(20) NOT NULL DEFAULT 'NEW',
    \`nextStep\` VARCHAR(300) NULL,
    \`followUpAt\` DATETIME(3) NULL,
    \`lastContactAt\` DATETIME(3) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,

    INDEX \`WholesaleProspect_stage_idx\`(\`stage\`),
    INDEX \`WholesaleProspect_followUpAt_idx\`(\`followUpAt\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`WholesaleActivity\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`prospectId\` VARCHAR(191) NOT NULL,
    \`kind\` VARCHAR(20) NOT NULL,
    \`direction\` VARCHAR(4) NOT NULL DEFAULT 'NONE',
    \`subject\` VARCHAR(300) NULL,
    \`body\` TEXT NOT NULL,
    \`messageId\` VARCHAR(500) NULL,
    \`author\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX \`WholesaleActivity_prospectId_createdAt_idx\`(\`prospectId\`, \`createdAt\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`WholesaleActivity_prospectId_fkey\` FOREIGN KEY (\`prospectId\`) REFERENCES \`WholesaleProspect\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`WholesaleSettings\` (
    \`id\` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    \`data\` TEXT NOT NULL,
    \`updatedAt\` DATETIME(3) NOT NULL,

    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
];

let ready: Promise<void> | null = null;
export function ensureWholesaleTables(): Promise<void> {
  ready ??= (async () => {
    for (const sql of WHOLESALE_TABLES) await prisma.$executeRawUnsafe(sql);
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}
