import path from "path";
import sharp from "sharp";

/**
 * Compresses a product photo uploaded from the admin before it is saved:
 * - turns it the right way up (camera orientation) and converts it to standard sRGB colour,
 * - shrinks it so the longest side is at most MAX_EDGE px (never enlarges, never crops or stretches),
 * - saves it as WebP at QUALITY, which keeps transparency and drops hidden data (camera, GPS).
 *
 * 2000px and quality 94 keep the photo looking like the original even when a shopper zooms in on the
 * product page (ProductZoom): a typical 1.2–1.8MB product photo is saved at ~160–420KB (photos on a plain
 * background come out smaller, with no loss). The pages themselves send screen-sized copies
 * (lib/images.ts), so this size isn't what shoppers download for each card.
 * If the photo can't be processed, the original is kept, so an upload never fails because of this.
 */
export const MAX_EDGE = 2000;
export const QUALITY = 94;

export type OptimizedImage = { buffer: Buffer; name: string; width?: number; height?: number; compressed: boolean };

export async function optimizeImageUpload(input: Buffer, originalName: string): Promise<OptimizedImage> {
  try {
    const { data, info } = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .toColorspace("srgb")
      .webp({ quality: QUALITY, effort: 5, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });

    // A photo that is already small and web-ready may not get smaller; then keep the original.
    if (data.length >= input.length) return { buffer: input, name: originalName, compressed: false };

    const base = path.basename(originalName, path.extname(originalName)) || "image";
    return { buffer: data, name: `${base}.webp`, width: info.width, height: info.height, compressed: true };
  } catch (err) {
    console.error("[upload] Image compression failed; saving the original.", err);
    return { buffer: input, name: originalName, compressed: false };
  }
}
