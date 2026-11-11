import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { uploadReadDirs } from "@/lib/storage";

/**
 * A product photo as an Instagram-ready JPEG: /api/social-image/<ProductImage id>.jpg
 * Used by the social pack (Admin → Marketing → Social pack), whose scheduler (e.g. Publer) downloads the
 * photos from here. 1080x1350 (4:5, the tallest Instagram allows in the feed), the whole photo on its own
 * background colour (read from its edges), sRGB JPEG. Public, like the photos on the product pages; only
 * product photos stored on this site are served.
 */
const W = 1080;
const H = 1350;

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const id = (await params).file.replace(/\.jpe?g$/i, "");
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new Response("Not found", { status: 404 });

  const image = await prisma.productImage.findUnique({ where: { id }, select: { url: true } });
  const parts = image?.url.match(/^\/uploads\/(.+)$/)?.[1]?.split("/");
  if (!parts) return new Response("Not found", { status: 404 });

  let input: Buffer | null = null;
  for (const dir of uploadReadDirs()) {
    const root = path.resolve(dir);
    const file = path.resolve(root, ...parts);
    if (!file.startsWith(root + path.sep)) continue;
    input = await fs.readFile(file).catch(() => null);
    if (input) break;
  }
  if (!input) return new Response("Not found", { status: 404 });

  try {
    const photo = sharp(input, { failOn: "none" }).rotate().toColorspace("srgb");
    const { data, info } = await photo.clone().resize(32, 32, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const background = edgeColour(data, info.width, info.height);
    const jpeg = await photo
      .resize({ width: W, height: H, fit: "contain", background })
      .flatten({ background })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(jpeg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch (err) {
    console.error("[social-image] Couldn't convert the photo.", err);
    return new Response("Not found", { status: 404 });
  }
}

/** The median colour of the photo's border, so the padding matches its background (white, grey, emerald…). */
function edgeColour(px: Buffer, w: number, h: number) {
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x > 0 && x < w - 1 && y > 0 && y < h - 1) continue;
      const i = (y * w + x) * 3;
      r.push(px[i]);
      g.push(px[i + 1]);
      b.push(px[i + 2]);
    }
  }
  const median = (a: number[]) => a.sort((m, n) => m - n)[Math.floor(a.length / 2)];
  return { r: median(r), g: median(g), b: median(b) };
}
