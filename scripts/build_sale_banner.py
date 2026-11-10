"""
The 11.11 sale page banner (src/components/sale/SaleBanner.tsx), from the originals in Banners/11.11:
  banner.png                         computers and tablets, 1672x941
  11.11 Sale Fashion Editorial.png   phones, 941x1672

Each banner has a ring of "11.11 SALE ·" lettering around "UP TO 70% OFF". To make the ring turn on the
page, it is split into two lossless WebP images:
  sale-banner-<kind>-v1.webp       the banner with the ring's lettering removed (black grain filled back in)
  sale-banner-<kind>-ring-v1.webp  just the ring's lettering, on a transparent square centred on the ring
The centre text stays in the banner. The script prints the ring's and the painted Shop Now button's position
in % of the picture, for SaleBanner.tsx and lib/banner-buttons.ts.

Run from the project folder:  python scripts/build_sale_banner.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Banners" / "11.11"
OUT = ROOT / "public" / "images" / "sale"

BANNERS = {
    # kind: (file, rough ring centre, rough ring radius, a plain patch of background (x0, y0, x1, y1), button area)
    "desktop": ("banner.png", (641, 645), 160, (20, 850, 520, 935), (40, 742, 440, 850)),
    "phone": ("11.11 Sale Fashion Editorial.png", (269, 1180), 150, (10, 420, 85, 1000), (205, 1488, 735, 1630)),
}


def lum(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def build(kind, file, guess, r_guess, patch, button_box):
    img = Image.open(SRC / file).convert("RGB")
    a = np.asarray(img).astype(np.float32)
    h, w = a.shape[:2]
    L = lum(a)
    # The photos: large bright areas. Opening (shrink, then grow) removes the thin lettering and keeps them;
    # grown by a few more pixels, so nothing at a photo's edge is ever changed.
    bright = Image.fromarray(((L > 45) * 255).astype(np.uint8))
    photo = np.asarray(bright.filter(ImageFilter.MinFilter(11)).filter(ImageFilter.MaxFilter(17))) > 0

    yy, xx = np.mgrid[0:h, 0:w]
    r0 = np.hypot(xx - guess[0], yy - guess[1])
    beige = (a[..., 0] > 110) & (a[..., 0] - a[..., 2] > 25) & (L > 90)
    text = beige & ~photo & (r0 > r_guess - 45) & (r0 < r_guess + 25)

    # fit a circle to the lettering: x² + y² + Dx + Ey + F = 0
    ys, xs = np.nonzero(text)
    A = np.column_stack([xs, ys, np.ones_like(xs)]).astype(np.float64)
    b = -(xs.astype(np.float64) ** 2 + ys.astype(np.float64) ** 2)
    D, E, F = np.linalg.lstsq(A, b, rcond=None)[0]
    cx, cy = -D / 2, -E / 2
    r = np.hypot(xx - cx, yy - cy)
    rt = r[text]
    r_in, r_out = np.percentile(rt, 0.5), np.percentile(rt, 99.5)

    ring = (r > r_in - 5) & (r < r_out + 5)
    # only the black ground and the lettering, never the photos
    ground = ring & ~photo
    photo_hits = int((ring & photo).sum())

    # 1) the banner without the lettering: black grain from the plain patch, tiled
    px0, py0, px1, py1 = patch
    tex = a[py0:py1, px0:px1]
    th, tw = tex.shape[:2]
    fill = tex[yy % th, xx % tw]
    m = Image.fromarray((ground * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    m = (np.asarray(m).astype(np.float32) / 255.0)[..., None]
    # keep the soft blend inside the ground only, so nothing outside it changes
    m = m * ring[..., None]
    base = a * (1 - m) + fill * m
    Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).save(OUT / f"sale-banner-{kind}-v1.webp", "WEBP", lossless=True, method=6)

    # 2) the lettering alone: its colour, with transparency from how bright each pixel is over the black
    colour = np.median(a[text & (L > np.percentile(L[text], 60))], axis=0)
    bg_l = float(np.median(L[ground & ~text]))
    alpha = np.clip((L - bg_l - 4) / (lum(colour[None, None, :])[0, 0] - bg_l), 0, 1) * ground
    R = int(np.ceil(r_out + 6))
    x0, y0 = int(round(cx)) - R, int(round(cy)) - R
    size = 2 * R
    rgba = np.zeros((size, size, 4), np.uint8)
    rgba[..., :3] = colour.astype(np.uint8)
    rgba[..., 3] = (alpha[y0:y0 + size, x0:x0 + size] * 255).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(OUT / f"sale-banner-{kind}-ring-v1.webp", "WEBP", lossless=True, method=6)

    # 3) the painted Shop Now button (the light pill)
    bx0, by0, bx1, by1 = button_box
    sub = a[by0:by1, bx0:bx1]
    pill = (lum(sub) > 150) & (sub[..., 0] - sub[..., 2] > 25)
    pys, pxs = np.nonzero(pill)
    left, top = bx0 + pxs.min(), by0 + pys.min()
    right, bottom = bx0 + pxs.max() + 1, by0 + pys.max() + 1

    pct = lambda v, total: round(100 * v / total, 2)
    print(f"{kind}: {w}x{h}, ring centre ({cx:.1f}, {cy:.1f}), lettering r {r_in:.1f}-{r_out:.1f}, photo pixels in ring: {photo_hits}")
    print(f"  ring box: left {pct(x0, w)}%, top {pct(y0, h)}%, width {pct(size, w)}%  ({size}px)")
    print(f"  button: left {pct(left, w)}, top {pct(top, h)}, width {pct(right - left, w)}, height {pct(bottom - top, h)}")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for kind, args in BANNERS.items():
        build(kind, *args)
