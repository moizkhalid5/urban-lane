/**
 * Pluggable image/file storage.
 *
 * IMAGE_STORAGE:
 *   "local" (default) — writes to UPLOAD_DIR (default /public/uploads), served from /uploads/*.
 *     In production set UPLOAD_DIR to a folder OUTSIDE the app (e.g. /home/<user>/urban-lane-uploads):
 *     `next start` only serves files that were in /public at build time, and redeploys replace the
 *     app folder. Files there are served by src/app/uploads/[...path]/route.ts.
 *   "cloudinary" | "s3" | "r2" — stubs ready for credentials (see notes below).
 *
 * All adapters expose the same `saveFile`/`deleteFile` contract so call sites
 * (admin product image upload) never change when you switch providers.
 */
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";

export type SavedFile = { url: string; key: string };

/** Where admin uploads are written (and read back by the /uploads route). */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "public", "uploads");

function safeName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin";
  return `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
}

async function saveLocal(file: Buffer, originalName: string): Promise<SavedFile> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const key = safeName(originalName);
  await fs.writeFile(path.join(UPLOAD_DIR, key), file);
  return { url: `/uploads/${key}`, key };
}

async function deleteLocal(key: string): Promise<void> {
  await fs.rm(path.join(UPLOAD_DIR, key), { force: true });
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
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
