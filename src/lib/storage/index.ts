/**
 * Pluggable image/file storage.
 *
 * IMAGE_STORAGE:
 *   "local" (default) — writes to UPLOAD_DIR, served from /uploads/* by src/app/uploads/[...path]/route.ts.
 *     Uploads must live OUTSIDE the app folder in production: a redeploy replaces the app folder (on
 *     19 Oct 2026 that deleted every admin upload), and `next start` only serves files that were in
 *     /public at build time.
 *   "cloudinary" | "s3" | "r2" — stubs ready for credentials (see notes below).
 *
 * All adapters expose the same `saveFile`/`deleteFile` contract so call sites
 * (admin product image upload) never change when you switch providers.
 */
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";

export type SavedFile = { url: string; key: string };

const APP_DIR = process.cwd();

/** The old default, inside the app folder. Still read, so uploads already saved there keep working. */
export const LEGACY_UPLOAD_DIR = path.join(APP_DIR, "public", "uploads");

/**
 * Where admin uploads are written. UPLOAD_DIR overrides. Otherwise production uses a folder next to
 * the app folder ("../urban-lane-uploads"), which a redeploy doesn't touch; development uses public/uploads.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : process.env.NODE_ENV === "production"
    ? path.resolve(APP_DIR, "..", "urban-lane-uploads")
    : LEGACY_UPLOAD_DIR;

/** Folders searched when serving an upload: the current location first, then the old one. */
export const UPLOAD_READ_DIRS = [...new Set([UPLOAD_DIR, LEGACY_UPLOAD_DIR])];

/** True when uploads are saved inside the app folder, where the next redeploy deletes them. */
export const uploadsAtRiskOfRedeploy =
  process.env.NODE_ENV === "production" && (UPLOAD_DIR === APP_DIR || UPLOAD_DIR.startsWith(APP_DIR + path.sep));

function safeName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin";
  return `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
}

async function saveLocal(file: Buffer, originalName: string): Promise<SavedFile> {
  const key = safeName(originalName);
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, key), file);
  } catch (err) {
    // Rather than failing the upload, keep it in the old location (still served) and say why.
    console.error(`[storage] Could not write to ${UPLOAD_DIR}; saved to ${LEGACY_UPLOAD_DIR} instead. Set UPLOAD_DIR.`, err);
    await fs.mkdir(LEGACY_UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(LEGACY_UPLOAD_DIR, key), file);
  }
  return { url: `/uploads/${key}`, key };
}

async function deleteLocal(key: string): Promise<void> {
  await Promise.all(UPLOAD_READ_DIRS.map((dir) => fs.rm(path.join(dir, key), { force: true })));
}

// ── Cloud stubs ────────────────────────────────────────────────────────────
// Implement these when credentials are available. They intentionally throw so a
// misconfiguration is obvious rather than silently dropping uploads.

async function saveCloudinary(): Promise<SavedFile> {
  // npm i cloudinary; use CLOUDINARY_* env vars; upload via cloudinary.uploader.upload_stream
  throw new Error("Cloudinary storage not yet implemented — add credentials and adapter.");
}
async function saveS3(): Promise<SavedFile> {
  // npm i @aws-sdk/client-s3; works for AWS S3 and Cloudflare R2 (S3-compatible).
  throw new Error("S3/R2 storage not yet implemented — add credentials and adapter.");
}

export async function saveFile(file: Buffer, originalName: string): Promise<SavedFile> {
  switch ((process.env.IMAGE_STORAGE || "local").toLowerCase()) {
    case "cloudinary":
      return saveCloudinary();
    case "s3":
    case "r2":
      return saveS3();
    default:
      return saveLocal(file, originalName);
  }
}

export async function deleteFile(key: string): Promise<void> {
  switch ((process.env.IMAGE_STORAGE || "local").toLowerCase()) {
    case "local":
      return deleteLocal(key);
    default:
      // No-op for stubs until implemented.
      return;
  }
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB; uploads are compressed before saving (optimize-image.ts)
