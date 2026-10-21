import { promises as fs } from "fs";
import path from "path";
import { MIME_TYPES, UPLOAD_READ_DIRS } from "@/lib/storage";
import { readFromDatabase, saveToDatabase } from "@/lib/storage/db-files";

/**
 * Serves admin-uploaded images at /uploads/<file>: from the database first (where uploads are stored
 * since 21 Oct 2026), then from disk (older uploads, local development). A file found only on disk is
 * copied into the database, so it survives the next redeploy.
 * Files that ship with the code (public/uploads/products/…) are served by Next directly.
 */
const HEADERS = { "Cache-Control": "public, max-age=31536000, immutable" };

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const type = MIME_TYPES[path.extname(parts[parts.length - 1] ?? "").toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  const key = parts.join("/");

  // Uploads are single flat file names; nested paths are catalogue files on disk.
  if (parts.length === 1) {
    try {
      const stored = await readFromDatabase(key);
      if (stored) return new Response(new Uint8Array(stored.data), { headers: { ...HEADERS, "Content-Type": stored.mimeType } });
    } catch (err) {
      console.error("[uploads] Database read failed; trying disk.", err);
    }
  }

  for (const dir of UPLOAD_READ_DIRS) {
    const root = path.resolve(dir);
    const file = path.resolve(root, ...parts);
    if (!file.startsWith(root + path.sep)) continue; // never anything outside the folder ("../" tricks)
    let data: Buffer;
    try {
      data = await fs.readFile(file);
    } catch {
      continue;
    }
    if (parts.length === 1) {
      saveToDatabase(key, data, type).catch(() => {}); // best effort; already stored is fine
    }
    return new Response(new Uint8Array(data), { headers: { ...HEADERS, "Content-Type": type } });
  }
  return new Response("Not found", { status: 404 });
}
