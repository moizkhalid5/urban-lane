import { prisma } from "@/lib/prisma";

/**
 * Admin-uploaded images stored in MySQL (table `StoredFile`). The database is the one place on the
 * host that survives redeploys: every deploy replaces the app's files, and on 19-20 Oct 2026 that
 * deleted 37 uploaded photos even from a folder next to the app.
 */

/** Largest file kept in the database. MEDIUMBLOB holds 16 MB; uploads are compressed first, typically 30-300 KB. */
export const MAX_DB_FILE_BYTES = 8 * 1024 * 1024;

// Same statement as prisma/migrations/20261021120000_stored_files, so the site works even if the
// host's deploy doesn't run migrations.
const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS \`StoredFile\` (
    \`key\` VARCHAR(191) NOT NULL,
    \`mimeType\` VARCHAR(100) NOT NULL,
    \`size\` INTEGER NOT NULL,
    \`data\` MEDIUMBLOB NOT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`key\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  tableReady ??= prisma.$executeRawUnsafe(CREATE_TABLE).then(
    () => undefined,
    (err) => {
      tableReady = null; // try again next time
      throw err;
    },
  );
  return tableReady;
}

export async function saveToDatabase(key: string, data: Buffer, mimeType: string): Promise<void> {
  if (data.length > MAX_DB_FILE_BYTES) {
    throw new Error(`Image is ${(data.length / 1024 / 1024).toFixed(1)} MB after compression; the limit is 8 MB.`);
  }
  await ensureTable();
  await prisma.storedFile.create({ data: { key, mimeType, size: data.length, data: new Uint8Array(data) } });
}

export async function readFromDatabase(key: string): Promise<{ data: Uint8Array; mimeType: string } | null> {
  await ensureTable();
  return prisma.storedFile.findUnique({ where: { key }, select: { data: true, mimeType: true } });
}

export async function deleteFromDatabase(key: string): Promise<void> {
  await ensureTable();
  await prisma.storedFile.deleteMany({ where: { key } });
}

/** Which of these keys are stored in the database. */
export async function keysInDatabase(keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  await ensureTable();
  const rows = await prisma.storedFile.findMany({ where: { key: { in: keys } }, select: { key: true } });
  return new Set(rows.map((r) => r.key));
}
