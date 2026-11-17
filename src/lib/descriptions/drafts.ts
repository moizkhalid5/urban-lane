import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Admin → Products → Descriptions: new product descriptions waiting for a person's OK. Batches arrive as a
 * JSON file ({ "batch": "…", "drafts": [{ "slug": "…", "description": "…" }] }), are reviewed one by one
 * (edit, approve or skip), and only an approval changes the product. The text it replaced is kept, so an
 * approval can be undone. Table created on first use (the host runs no migrations).
 */

export const DRAFTS_TABLE = `CREATE TABLE IF NOT EXISTS \`ProductCopyDraft\` (
    \`productId\` VARCHAR(191) NOT NULL,
    \`proposed\` TEXT NOT NULL,
    \`previous\` TEXT NULL,
    \`status\` VARCHAR(16) NOT NULL DEFAULT 'pending',
    \`batch\` VARCHAR(64) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`reviewedAt\` DATETIME(3) NULL,
    PRIMARY KEY (\`productId\`),
    INDEX \`ProductCopyDraft_status_idx\` (\`status\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

let ready: Promise<unknown> | null = null;
export function ensureDraftsTable() {
  ready ??= prisma.$executeRawUnsafe(DRAFTS_TABLE).catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

export type DraftStatus = "pending" | "approved" | "skipped";
type Row = { productId: string; proposed: string; previous: string | null; status: DraftStatus; batch: string | null; createdAt: Date; reviewedAt: Date | null };

/** A description shorter than this (or none) counts as thin: "100% Cotton", a single line copied from a brand site. */
export const THIN_CHARS = 120;

/** Tidy a description for saving: Windows line ends, trailing spaces, at most one blank line between paragraphs. */
export const tidy = (s: string) =>
  s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export async function draftSummary() {
  await ensureDraftsTable();
  const [counts, products] = await Promise.all([
    prisma.$queryRaw<{ status: DraftStatus; n: bigint }[]>`SELECT status, COUNT(*) AS n FROM ProductCopyDraft GROUP BY status`,
    prisma.product.findMany({ where: { status: "ACTIVE" }, select: { description: true } }),
  ]);
  const by = (s: DraftStatus) => Number(counts.find((c) => c.status === s)?.n ?? 0);
  return {
    pending: by("pending"),
    approved: by("approved"),
    skipped: by("skipped"),
    live: products.length,
    thin: products.filter((p) => (p.description?.trim().length ?? 0) < THIN_CHARS).length,
  };
}

/**
 * Loads a batch file. Drafts are matched to products by slug (the end of the product's web address) or SKU.
 * A product already approved keeps its approval unless the file brings different text, which goes back to
 * the queue. Returns what happened, including slugs that matched nothing.
 */
export async function importDrafts(json: unknown) {
  await ensureDraftsTable();
  const data = json as { batch?: unknown; drafts?: unknown };
  if (!data || !Array.isArray(data.drafts)) throw new Error('The file needs a "drafts" list.');
  const batch = typeof data.batch === "string" ? data.batch.slice(0, 64) : null;
  const drafts = (data.drafts as { slug?: unknown; sku?: unknown; description?: unknown }[])
    .map((d) => ({ key: String(d.slug ?? d.sku ?? "").trim(), text: typeof d.description === "string" ? tidy(d.description) : "" }))
    .filter((d) => d.key && d.text.length >= 40 && d.text.length <= 5000);

  const keys = drafts.map((d) => d.key);
  const products = await prisma.product.findMany({
    where: { OR: [{ slug: { in: keys } }, { sku: { in: keys } }] },
    select: { id: true, slug: true, sku: true },
  });
  const find = (key: string) => products.find((p) => p.slug === key || p.sku === key);
  const existing = await prisma.$queryRaw<Row[]>`SELECT * FROM ProductCopyDraft WHERE productId IN (${Prisma.join(products.length ? products.map((p) => p.id) : [""])})`;

  let added = 0;
  let unchanged = 0;
  const unknown: string[] = [];
  for (const d of drafts) {
    const p = find(d.key);
    if (!p) {
      unknown.push(d.key);
      continue;
    }
    const prev = existing.find((e) => e.productId === p.id);
    if (prev && prev.proposed === d.text && prev.status !== "skipped") {
      unchanged += 1;
      continue;
    }
    await prisma.$executeRaw`INSERT INTO ProductCopyDraft (productId, proposed, status, batch) VALUES (${p.id}, ${d.text}, 'pending', ${batch})
      ON DUPLICATE KEY UPDATE proposed = VALUES(proposed), status = 'pending', batch = VALUES(batch), createdAt = CURRENT_TIMESTAMP(3), reviewedAt = NULL`;
    added += 1;
  }
  return { added, unchanged, unknown, ignored: (data.drafts as unknown[]).length - drafts.length };
}

export async function listDrafts(status: DraftStatus, take = 30) {
  await ensureDraftsTable();
  const rows = await prisma.$queryRaw<Row[]>`SELECT * FROM ProductCopyDraft WHERE status = ${status} ORDER BY ${
    status === "pending" ? Prisma.sql`createdAt ASC` : Prisma.sql`reviewedAt DESC`
  } LIMIT ${take}`;
  const products = await prisma.product.findMany({
    where: { id: { in: rows.map((r) => r.productId) } },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      details: true,
      status: true,
      brand: { select: { name: true } },
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
    },
  });
  return rows.flatMap((r) => {
    const product = products.find((p) => p.id === r.productId);
    return product ? [{ ...r, product }] : [];
  });
}

/** Saves the (possibly edited) text on the product and records the old one for undo. */
export async function approveDraft(productId: string, text: string) {
  await ensureDraftsTable();
  const clean = tidy(text);
  if (clean.length < 40) throw new Error("That description is too short.");
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { description: true } });
  if (!product) throw new Error("That product no longer exists.");
  await prisma.$transaction([
    prisma.product.update({ where: { id: productId }, data: { description: clean } }),
    prisma.$executeRaw`UPDATE ProductCopyDraft SET proposed = ${clean}, previous = ${product.description}, status = 'approved', reviewedAt = CURRENT_TIMESTAMP(3) WHERE productId = ${productId}`,
  ]);
}

export async function skipDraft(productId: string) {
  await ensureDraftsTable();
  await prisma.$executeRaw`UPDATE ProductCopyDraft SET status = 'skipped', reviewedAt = CURRENT_TIMESTAMP(3) WHERE productId = ${productId}`;
}

/** Puts back the description an approval replaced; the draft returns to the queue. */
export async function undoDraft(productId: string) {
  await ensureDraftsTable();
  const [row] = await prisma.$queryRaw<Row[]>`SELECT * FROM ProductCopyDraft WHERE productId = ${productId} AND status = 'approved'`;
  if (!row) return;
  await prisma.$transaction([
    prisma.product.update({ where: { id: productId }, data: { description: row.previous } }),
    prisma.$executeRaw`UPDATE ProductCopyDraft SET status = 'pending', reviewedAt = NULL WHERE productId = ${productId}`,
  ]);
}
