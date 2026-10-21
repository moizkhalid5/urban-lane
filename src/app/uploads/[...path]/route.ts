import { promises as fs } from "fs";
import path from "path";
import { MIME_TYPES, uploadReadDirs } from "@/lib/storage";

/**
 * Serves admin-uploaded photos at /uploads/<file> from the photos folder (UPLOAD_DIR), then from the
 * photos that ship with the code (public/uploads). Catalogue photos (public/uploads/products/…) are
 * usually served by Next directly.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const type = MIME_TYPES[path.extname(parts[parts.length - 1] ?? "").toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });

  for (const dir of uploadReadDirs()) {
    const root = path.resolve(dir);
    const file = path.resolve(root, ...parts);
    if (!file.startsWith(root + path.sep)) continue; // never anything outside the folder ("../" tricks)
    try {
      const data = await fs.readFile(file);
      return new Response(new Uint8Array(data), {
        headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
      });
    } catch {
      continue;
    }
  }
  return new Response("Not found", { status: 404 });
}
