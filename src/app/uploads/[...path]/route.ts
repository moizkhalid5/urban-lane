import { promises as fs } from "fs";
import path from "path";
import { UPLOAD_DIR } from "@/lib/storage";

/**
 * Serves admin-uploaded images from UPLOAD_DIR at /uploads/<file>.
 * Files that ship with the code (public/uploads/products/…) are served by Next directly
 * and never reach this route; this covers images uploaded after the site was built.
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
  const file = path.resolve(UPLOAD_DIR, ...parts);
  const type = TYPES[path.extname(file).toLowerCase()];
  // Only image files, and never anything outside UPLOAD_DIR ("../" tricks).
  if (!type || !file.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
