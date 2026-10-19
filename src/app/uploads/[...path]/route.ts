import { promises as fs } from "fs";
import path from "path";
import { UPLOAD_DIR, UPLOAD_READ_DIRS } from "@/lib/storage";

/**
 * Serves admin-uploaded images at /uploads/<file>, looking in the current upload folder first and
 * then the old one inside the app (public/uploads). A file found only in the old folder is copied
 * to the current one, so it survives the next redeploy.
 * Files that ship with the code (public/uploads/products/…) are served by Next directly.
 */
const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const type = TYPES[path.extname(parts[parts.length - 1] ?? "").toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });

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
    if (root !== path.resolve(UPLOAD_DIR)) {
      const target = path.resolve(UPLOAD_DIR, ...parts);
      fs.mkdir(path.dirname(target), { recursive: true })
        .then(() => fs.copyFile(file, target))
        .catch(() => {}); // best effort; the file is still served from the old folder
    }
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  }
  return new Response("Not found", { status: 404 });
}
