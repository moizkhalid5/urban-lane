"""
Builds the homepage hero slider images from the original artwork in Banners/ (not committed).

Every slide is cut to the main banner's shape (1916 x 821, 2.334:1) at full resolution and saved as
high-quality WebP: one full-size file for computers and a 960px-wide one for smaller screens. The site serves
these files as they are (no further compression), so text and gradients stay sharp.

Run from the project root:  python scripts/build_home_banners.py
Prints each painted button's position (% of the new image) for src/lib/banner-buttons.ts, and the
colour of each slide's top edge (the strip behind the menu, src/lib/collection-heroes.ts).
"""
import os
from PIL import Image, ImageFilter

RATIO = 1916 / 821
OUT = "public/images/banners/home"

# name: (source, crop top in source px, buttons as (left, top, width, height) in SOURCE px)
SLIDES = {
    "urban-lane": ("Banners/Main_banner.png", 0, [(173, 559, 284, 72)]),
    # Men's winter (1897x829): trim 8px top and bottom; SHOP NOW is the gold outline box.
    "men-winter": ("Banners/banner_2_men.png", 8, [(1112, 548, 368, 79)]),
    # Women.png is 1862x845: keep the full width, trim 47px off the bottom (button kept inside).
    "women": ("Banners/Women.png", 0, [(120 + 0.3249 * 1690, 0.6935 * 845, 0.1568 * 1690, 0.0734 * 845)]),
    # 1672x941 originals; the old 2:1 site banners were cut at y=85 / 40. New windows are centred on
    # those (so the framing is the same), nudged to keep painted buttons and text whole.
}

# Homepage winter banner, full width at 3.8:1 on tablets and computers ("winter-wide"); phones get the
# whole picture ("winter"), because a 3.8:1 strip would be ~100px tall there.
# The wide cut keeps the text, the DISCOVER NOW button and the three faces (hair from y=152).
PROMOS = {
    "winter-wide": ("Banners/winter_new.png", 70, [(1368, 439, 222, 39)], 3.8),
    "winter": ("Banners/winter_new.png", 0, [(1368, 439, 222, 39)], RATIO),
}

# Slides whose studio background is plain: instead of cropping (which cut the children's heads and shoes on
# the kids slide), the whole picture is kept and its background is extended: px added above (so the
# models sit clear of the see-through menu), then the sides widened to the slide's shape. Saved as
# "<name>-<width>.webp" (lossless) + "-960".
# name: (source, px above, buttons in SOURCE px)
EXTENDED = {
    "kids-summer": ("Banners/kids.png", 90, [(0.7087 * 1672, 85 + 0.6089 * 836, 0.1112 * 1672, 0.061 * 836)]),
}

os.makedirs(OUT, exist_ok=True)

def extend(im, top, ratio):
    """The whole picture on a bigger canvas of its own background: `top` px above, sides widened to
    `ratio`. New pixels carry on the nearest edge colour (smoothed) plus the picture's faint grain."""
    import numpy as np
    w, h = im.size
    H = h + top
    W = max(w, round(H * ratio))
    left = (W - w) // 2
    soft = np.asarray(im.filter(ImageFilter.GaussianBlur(8))).astype(float)
    out = np.pad(soft, ((top, 0), (left, W - w - left), (0, 0)), mode="edge")
    out += np.random.default_rng(1).normal(0, 0.75, out.shape[:2])[..., None]
    out[top:, left:left + w] = np.asarray(im)
    return Image.fromarray(np.clip(np.rint(out), 0, 255).astype(np.uint8)), left

# Sale (1672x941): a 716px-tall cut sliced through the model's head. Instead the top 840 rows (her whole
# head down to SHOP NOW, with room) are kept and the extra width goes on the right, where the wall is
# evenly lit: that strip's light and shadow continued outwards (mirrored, then repeated) with the stone's
# own grain, so the join can't be seen. (The left has diagonal shadows, which don't continue cleanly.)
# name: (source, rows kept, buttons in SOURCE px).
WIDENED = {
    "sale-season": ("Banners/Sale.png", 840, [(0.1274 * 1672, 40 + 0.8493 * 836, 0.1435 * 1672, 0.0801 * 836)]),
}

def widen_right(im, rows, ratio):
    import numpy as np
    w = im.size[0]
    pad = round(rows * ratio) - w
    n = (pad + 1) // 2
    a = np.asarray(im).astype(float)[:rows]
    lo = np.asarray(im.filter(ImageFilter.GaussianBlur(3))).astype(float)[:rows]
    strip_lo, strip_grain = lo[:, w - n:], (a - lo)[:, w - n:]
    extra = np.concatenate([strip_lo[:, ::-1] + strip_grain, strip_lo + strip_grain], axis=1)[:, :pad]
    return Image.fromarray(np.clip(np.rint(np.concatenate([a, extra], axis=1)), 0, 255).astype(np.uint8))

for name, (src, rows, buttons) in WIDENED.items():
    cut = widen_right(Image.open(src).convert("RGB"), rows, RATIO)
    W, H = cut.size
    path = f"{OUT}/{name}-{W}.webp"
    cut.save(path, "WEBP", lossless=True, method=6)
    cut.resize((960, round(960 * H / W)), Image.LANCZOS).save(f"{OUT}/{name}-960.webp", "WEBP", quality=92, method=6)
    print(f"{name}: {src} -> {cut.size}, {os.path.getsize(path)//1024} KB")
    for (bx, by, bw, bh) in buttons:
        assert by + bh <= H, (name, "button outside")
        print(f"   button: left {bx / W * 100:.2f}, top {by / H * 100:.2f}, width {bw / W * 100:.2f}, height {bh / H * 100:.2f}")

for name, (src, top, buttons) in EXTENDED.items():
    im = Image.open(src).convert("RGB")
    cut, left = extend(im, top, RATIO)
    W, H = cut.size
    path = f"{OUT}/{name}-{W}.webp"
    cut.save(path, "WEBP", lossless=True, method=6)
    cut.resize((960, round(960 * H / W)), Image.LANCZOS).save(f"{OUT}/{name}-960.webp", "WEBP", quality=92, method=6)
    print(f"{name}: {src} -> {cut.size}, {os.path.getsize(path)//1024} KB")
    for (bx, by, bw, bh) in buttons:
        print(f"   button: left {(bx + left) / W * 100:.2f}, top {(by + top) / H * 100:.2f}, width {bw / W * 100:.2f}, height {bh / H * 100:.2f}")

for name, (src, top, buttons, *ratio) in [(k, v) for k, v in SLIDES.items()] + [(k, v) for k, v in PROMOS.items()]:
    im = Image.open(src).convert("RGB")
    w = im.size[0]
    h = round(w / (ratio[0] if ratio else RATIO))
    assert top + h <= im.size[1], (name, top, h, im.size)
    cut = im.crop((0, top, w, top + h))
    full = f"{OUT}/{name}-{w}.webp"
    cut.save(full, "WEBP", quality=92, method=6)
    small = cut.resize((960, round(960 * h / w)), Image.LANCZOS)
    small.save(f"{OUT}/{name}-960.webp", "WEBP", quality=90, method=6)
    top_edge = cut.crop((0, 0, w, 6)).resize((1, 1), Image.BOX).getpixel((0, 0))
    print(f"{name}: {src} -> {cut.size}, {os.path.getsize(full)//1024} KB full, {os.path.getsize(f'{OUT}/{name}-960.webp')//1024} KB phone, top edge #{''.join(f'{c:02x}' for c in top_edge)}")
    for (bx, by, bw, bh) in buttons:
        assert by >= top and by + bh <= top + h, (name, "button outside the crop")
        print(f"   button: left {bx / w * 100:.2f}, top {(by - top) / h * 100:.2f}, width {bw / w * 100:.2f}, height {bh / h * 100:.2f}")
