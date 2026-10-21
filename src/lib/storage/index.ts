/**
 * Storage for photos uploaded from the admin.
 *
 * UPLOAD_DIR (environment variable) is the folder where uploaded photos are written and read from.
 *   On Hostinger it must be OUTSIDE the deployment folder: every redeploy deletes the app's files, which
 *   is how 37 uploaded photos were lost in Oct 2026. Example: /home/u123456789/urban-lane-uploads
 *   ("~/urban-lane-uploads" also works). The folder is created if it doesn't exist.
 *
 * Products store only "/uploads/<file name>", never the folder. To move the photos to another folder:
 * move the files, change UPLOAD_DIR, restart the app. Nothing else changes.
 *
 * In production, uploads are refused (with a clear message in the admin) while UPLOAD_DIR is missing or
 * points inside the app folder, so a photo is never silently saved where a redeploy would delete it.
 * In development UPLOAD_DIR defaults to public/uploads.
 *
 * IMAGE_STORAGE: "local" (default, the folder above) | "cloudinary" | "s3" | "r2" (stubs, see below).
 */
import { promises as fs, constants as fsConstants } from "fs";
import os from "os";
import path from "path";
import { randomBytes } from "crypto";

export type SavedFile = { url: string; key: string };

const APP_DIR = process.cwd();
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Photos that ship with the code: catalogue photos (products/<sku>/…) and photos rescued from the live site. */
export const BUNDLED_UPLOAD_DIR = path.join(APP_DIR, "public", "uploads");

/** A problem with UPLOAD_DIR, worded for the admin. */
export class UploadFolderError extends Error {}

/** The configured photos folder (absolute), or null when UPLOAD_DIR isn't set in production. Read on every call. */
export function uploadDir(): string | null {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (!configured) return IS_PRODUCTION ? null : BUNDLED_UPLOAD_DIR;
  const expanded = configured === "~" || configured.startsWith("~/") ? path.join(os.homedir(), configured.slice(1)) : configured;
  return path.resolve(APP_DIR, expanded);
}

function isInsideApp(dir: string): boolean {
  return dir === APP_DIR || dir.startsWith(APP_DIR + path.sep);
}

/** Folders searched when serving /uploads/<file>: the photos folder, then the photos that ship with the code. */
export function uploadReadDirs(): string[] {
  const dir = uploadDir();
  return [...new Set([...(dir ? [dir] : []), BUNDLED_UPLOAD_DIR])];
}

export type UploadFolderStatus = { dir: string | null; appDir: string; ok: boolean; problem: string | null; photoCount: number };

/** Checks the photos folder is set, outside the app, exists and is writable. Shown on the admin dashboard. */
export async function uploadFolderStatus(): Promise<UploadFolderStatus> {
  const status = await checkUploadFolder();
  return { ...status, appDir: APP_DIR };
}

async function checkUploadFolder(): Promise<Omit<UploadFolderStatus, "appDir">> {
  const dir = uploadDir();
  if (!dir) {
    return { dir, ok: false, photoCount: 0, problem: "UPLOAD_DIR isn't set, so photos can't be uploaded." };
  }
  if (IS_PRODUCTION && isInsideApp(dir)) {
    return { dir, ok: false, photoCount: 0, problem: "UPLOAD_DIR points inside the website's deployment folder, which every redeploy deletes." };
  }
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) return { dir, ok: false, photoCount: 0, problem: "UPLOAD_DIR points to a file, not a folder." };
    await fs.access(dir, fsConstants.R_OK | fsConstants.W_OK);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { dir, ok: true, photoCount: 0, problem: null }; // created on the first upload
    }
    return { dir, ok: false, photoCount: 0, problem: `The website can't read and write this folder (${code ?? "error"}). Check the path and its permissions.` };
  }
  const photoCount = (await fs.readdir(dir).catch(() => [])).filter((f) => MIME_TYPES[path.extname(f).toLowerCase()]).length;
  return { dir, ok: true, problem: null, photoCount };
}

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

async function saveLocal(file: Buffer, originalName: string): Promise<SavedFile> {
  const dir = uploadDir();
  if (!dir) {
    throw new UploadFolderError("Photos can't be uploaded yet: the UPLOAD_DIR environment variable isn't set in hPanel.");
  }
  if (IS_PRODUCTION && isInsideApp(dir)) {
    throw new UploadFolderError(`Photos can't be uploaded: UPLOAD_DIR (${dir}) is inside the website's deployment folder, which every redeploy deletes. Set it to a folder outside it.`);
  }
  const key = safeName(originalName);
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, key), file);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? "error";
    throw new UploadFolderError(`Couldn't save the photo in ${dir} (${code}). Check that UPLOAD_DIR is correct and the folder can be written to.`);
  }
  return { url: `/uploads/${key}`, key };
}

async function deleteLocal(key: string): Promise<void> {
  const dir = uploadDir();
  if (!dir || path.basename(key) !== key) return; // only plain file names, only in the photos folder
  await fs.rm(path.join(dir, key), { force: true });
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
    case "cloudinary":
    case "s3":
    case "r2":
      return; // No-op for stubs until implemented.
    default:
      return deleteLocal(key);
  }
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB; uploads are compressed before saving (optimize-image.ts)
