import { promises as fs } from "fs";
import path from "path";
import { MIME_TYPES } from "@/lib/storage";

const ROOT = path.join(process.cwd(), "public", "images");

/**
 * Serves the pictures in public/images at /img/<path>, cached by browsers for a year.
 *
 * Hostinger serves files in public/ itself and gives .jpg a year's cache but .webp and .avif none, so every
 * visit re-checked the banners (PageSpeed: "Use efficient cache lifetimes"). Pictures here never change in
 * place (a replaced banner gets a new file name: -v2, -v3…), so a year is safe.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const type = MIME_TYPES[path.extname(parts[parts.length - 1] ?? "").toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  const file = path.resolve(ROOT, ...parts);
  if (!file.startsWith(ROOT + path.sep)) return new Response("Not found", { status: 404 }); // never outside the folder
  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
