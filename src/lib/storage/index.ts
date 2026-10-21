/**
 * Pluggable image/file storage.
 *
 * IMAGE_STORAGE:
 *   "database" (default) — admin uploads are stored in MySQL (db-files.ts) and served from /uploads/*
 *     by src/app/uploads/[...path]/route.ts. Hostinger replaces the app's files on every deploy, and
 *     on 19-20 Oct 2026 that deleted 37 uploaded photos, first from public/uploads and then from a
 *     folder next to the app. The database survives deploys, so uploads now live there.
 *   "local" — writes to UPLOAD_DIR on disk, in development only. In production "local" means "database":
 *     the hosting env vars were set up with IMAGE_STORAGE=local and a placeholder UPLOAD_DIR, which is how
 *     uploads ended up inside the app folder and were deleted by deploys.
 *   "disk" — writes to UPLOAD_DIR on disk in production too (only for a host with a persistent disk).
 *   "cloudinary" | "s3" | "r2" — stubs ready for credentials (see notes below).
 *
 * All adapters expose the same `saveFile`/`deleteFile` contract so call sites
 * (admin product image upload) never change when you switch providers.
 */
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { saveToDatabase, deleteFromDatabase } from "./db-files";

export type SavedFile = { url: string; key: string };

const APP_DIR = process.cwd();
const STORAGE = resolveStorage((process.env.IMAGE_STORAGE || "database").toLowerCase());

function resolveStorage(configured: string): string {
  if (configured === "disk") return "local";
  if (configured === "local" && process.env.NODE_ENV === "production") return "database";
  return configured;
}

/** Files that ship with the code (catalogue photos) and uploads saved there before Oct 2026. */
export const LEGACY_UPLOAD_DIR = path.join(APP_DIR, "public", "uploads");

/** Disk folder for IMAGE_STORAGE=local. */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : LEGACY_UPLOAD_DIR;

/**
 * Folders searched (after the database) when serving an upload: the configured folder, the app's
 * public/uploads, and the folder next to the app used from 19 to 21 Oct 2026. A file found on disk
 * is copied into the database the first time it's served, so it survives the next deploy.
 */
export const UPLOAD_READ_DIRS = [
  ...new Set([UPLOAD_DIR, LEGACY_UPLOAD_DIR, path.resolve(APP_DIR, "..", "urban-lane-uploads")]),
];

/** True when uploads are saved on disk inside the app folder in production (IMAGE_STORAGE=disk), where a redeploy deletes them. */
export const uploadsAtRiskOfRedeploy =
  STORAGE === "local" &&
  process.env.NODE_ENV === "production" &&
  (UPLOAD_DIR === APP_DIR || UPLOAD_DIR.startsWith(APP_DIR + path.sep));

export const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function safeName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin";
  return `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
}

async function saveDatabase(file: Buffer, originalName: string): Promise<SavedFile> {
  const key = safeName(originalName);
  const mimeType = MIME_TYPES[path.extname(key)] ?? "application/octet-stream";
  await saveToDatabase(key, file, mimeType);
  return { url: `/uploads/${key}`, key };
}

async function saveLocal(file: Buffer, originalName: string): Promise<SavedFile> {
  const key = safeName(originalName);
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, key), file);
  return { url: `/uploads/${key}`, key };
}

async function deleteStored(key: string): Promise<void> {
  await Promise.all([
    deleteFromDatabase(key).catch(() => {}),
    ...UPLOAD_READ_DIRS.map((dir) => fs.rm(path.join(dir, key), { force: true })),
  ]);
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
  switch (STORAGE) {
    case "cloudinary":
      return saveCloudinary();
    case "s3":
    case "r2":
      return saveS3();
    case "local":
      return saveLocal(file, originalName);
    default:
      return saveDatabase(file, originalName);
  }
}

export async function deleteFile(key: string): Promise<void> {
  switch (STORAGE) {
    case "local":
    case "database":
      return deleteStored(key);
    default:
      // No-op for stubs until implemented.
      return;
  }
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB; uploads are compressed before saving (optimize-image.ts)
