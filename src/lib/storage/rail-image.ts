import path from "path";
import sharp from "sharp";

/**
 * Prepares a hanging-rail photo (Admin → Homepage rail): a garment on a hanger against a plain background.
 * The background is made transparent, so garments can hang in front of the big word behind the rail and
 * overlap each other on the homepage.
 *
 * How: the background colour is read from the photo's border; every pixel connected to the border that is
 * close to that colour becomes transparent, with a soft edge (the colour is "un-mixed" from the background
 * so there is no white fringe). Pixels inside the garment are never touched, even light ones (ivory, white),
 * because they aren't connected to the border through background-coloured pixels.
 * If the border isn't one plain colour (a busy photo), the photo is kept as it is and `removed` is false.
 *
 * The result is a WebP with transparency, at most MAX_HEIGHT px tall (the rail is at most ~560px tall,
 * so this is sharp on retina screens). Typical size: 60–150KB.
 */
export const MAX_HEIGHT = 1200;
const QUALITY = 86;
/** colour distance (0–255, largest channel difference) treated as background, and where the soft edge ends */
const BG_FULL = 8;
const BG_EDGE = 26;

export type RailImage = { buffer: Buffer; name: string; width: number; height: number; removed: boolean };

export async function prepareRailImage(input: Buffer, originalName: string): Promise<RailImage> {
  const { data, info } = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ height: MAX_HEIGHT, withoutEnlargement: true })
    .toColorspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0, j = 0; i < W * H; i++, j += 3) {
    rgba[i * 4] = data[j];
    rgba[i * 4 + 1] = data[j + 1];
    rgba[i * 4 + 2] = data[j + 2];
    rgba[i * 4 + 3] = 255;
  }

  const bg = borderColour(data, W, H);
  if (bg) {
    const dist = (i: number) =>
      Math.max(Math.abs(data[i * 3] - bg[0]), Math.abs(data[i * 3 + 1] - bg[1]), Math.abs(data[i * 3 + 2] - bg[2]));
    // Flood fill from the border through background-like pixels
    const seen = new Uint8Array(W * H);
    const stack: number[] = [];
    const push = (i: number) => {
      if (!seen[i] && dist(i) <= BG_EDGE) {
        seen[i] = 1;
        stack.push(i);
      }
    };
    for (let x = 0; x < W; x++) {
      push(x);
      push((H - 1) * W + x);
    }
    for (let y = 0; y < H; y++) {
      push(y * W);
      push(y * W + W - 1);
    }
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W;
      if (x > 0) push(i - 1);
      if (x < W - 1) push(i + 1);
      if (i >= W) push(i - W);
      if (i < W * (H - 1)) push(i + W);
    }
    for (let i = 0; i < W * H; i++) {
      if (!seen[i]) continue;
      const d = dist(i);
      const a = d <= BG_FULL ? 0 : (d - BG_FULL) / (BG_EDGE - BG_FULL);
      rgba[i * 4 + 3] = Math.round(a * 255);
      if (a > 0) {
        for (let c = 0; c < 3; c++) {
          const v = bg[c] + (data[i * 3 + c] - bg[c]) / a;
          rgba[i * 4 + c] = Math.max(0, Math.min(255, Math.round(v)));
        }
      }
    }
  }

  const buffer = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: QUALITY, alphaQuality: 90, effort: 5, smartSubsample: true })
    .toBuffer();
  const base = path.basename(originalName, path.extname(originalName)).replace(/[^a-z0-9-]+/gi, "-").slice(0, 40) || "rail";
  return { buffer, name: `${base}.webp`, width: W, height: H, removed: !!bg };
}

/** The background colour, when the photo's border is one plain colour; otherwise null. */
function borderColour(data: Buffer, W: number, H: number): [number, number, number] | null {
  const samples: [number, number, number][] = [];
  const step = Math.max(1, Math.floor((W + H) / 200));
  const add = (x: number, y: number) => {
    const j = (y * W + x) * 3;
    samples.push([data[j], data[j + 1], data[j + 2]]);
  };
  for (let x = 0; x < W; x += step) {
    add(x, 0);
    add(x, H - 1);
  }
  for (let y = 0; y < H; y += step) {
    add(0, y);
    add(W - 1, y);
  }
  const median = [0, 1, 2].map((c) => samples.map((s) => s[c]).sort((a, b) => a - b)[samples.length >> 1]) as [number, number, number];
  const close = samples.filter((s) => Math.max(...s.map((v, c) => Math.abs(v - median[c]))) <= BG_FULL).length;
  return close / samples.length >= 0.9 ? median : null;
}
