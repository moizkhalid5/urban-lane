"""
Builds the homepage hero slider images from the original artwork in Banners/ (not committed).

Every slide is cut to the main banner's shape (1916 x 821, 2.334:1) at full resolution and saved as
high-quality WebP: one full-size file for computers and a 960px-wide one for phones. The site serves
these files as they are (no further compression), so text and gradients stay sharp.

Run from the project root:  python scripts/build_home_banners.py
Prints each painted button's position (% of the new image) for src/lib/banner-buttons.ts, and the
colour of each slide's top edge (the strip behind the menu, src/lib/collection-heroes.ts).
"""
import os
import random
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
    "kids": ("Banners/kids.png", 85 + 418 - 358, [(0.7087 * 1672, 85 + 0.6089 * 836, 0.1112 * 1672, 0.061 * 836)]),
    "sale": ("Banners/Sale.png", 102, [(0.1274 * 1672, 40 + 0.8493 * 836, 0.1435 * 1672, 0.0801 * 836)]),
}

# Homepage winter banner, full width at 3.8:1 on tablets and computers ("winter-wide"); phones get the
# whole picture ("winter"), because a 3.8:1 strip would be ~100px tall there.
# The wide cut keeps the text, the DISCOVER NOW button and the three faces (hair from y=152).
PROMOS = {
    "winter-wide": ("Banners/winter_new.png", 70, [(1368, 439, 222, 39)], 3.8),
    "winter": ("Banners/winter_new.png", 0, [(1368, 439, 222, 39)], RATIO),
}

# Phone versions of the slides at 3:2 (taller than the 2.334:1 desktop banners), one 1200x800 file each.
# name: (source, crop left in source px, crop width, px to add above, buttons in SOURCE px[, "sky"]).
# The main banner's lettering runs nearly edge to edge, so instead of cutting its sides it gets plain
# background added above (each column's own top colour). The men's winter banner's model and text are
# too far apart for a 3:2 cut, so it gets soft overcast sky added above ("sky": the top edge's colours,
# smoothed, slightly lighter towards the top, with faint grain).
MOBILE_RATIO = 1.5
MOBILE = {
    "urban-lane": ("Banners/Main_banner.png", 100, 1716, 323, [(173, 559, 284, 72)]),
    "men-winter": ("Banners/banner_2_men.png", 250, 1540, 198, [(1112, 548, 368, 79)], "sky"),
    "women": ("Banners/Women.png", 390, 1268, 0, [(120 + 0.3249 * 1690, 0.6935 * 845, 0.1568 * 1690, 0.0734 * 845)]),
    "kids": ("Banners/kids.png", 230, 1412, 0, [(0.7087 * 1672, 85 + 0.6089 * 836, 0.1112 * 1672, 0.061 * 836)]),
    "sale": ("Banners/Sale.png", 150, 1412, 0, [(0.1274 * 1672, 40 + 0.8493 * 836, 0.1435 * 1672, 0.0801 * 836)]),
}

os.makedirs(OUT, exist_ok=True)
def sky_above(cut, add):
    width = cut.size[0]
    strip = cut.crop((0, 0, width, 20)).resize((width, 1), Image.BOX).filter(ImageFilter.GaussianBlur(90))
    sky = strip.resize((width, add))
    px = sky.load()
    random.seed(1)
    for y in range(add):
        t = (add - y) / add * 0.06  # up to 6% lighter at the very top
        for x in range(width):
            n = random.randint(-3, 3)
            px[x, y] = tuple(min(255, int(c + (255 - c) * t) + n) for c in px[x, y])
    return sky.filter(ImageFilter.GaussianBlur(1.2))

for name, (src, left, width, add_top, buttons, *mode) in MOBILE.items():
    im = Image.open(src).convert("RGB")
    h = round(width / MOBILE_RATIO)
    cut = im.crop((left, 0, left + width, h - add_top))
    if add_top:
        canvas = Image.new("RGB", (width, h))
        if mode == ["sky"]:
            canvas.paste(sky_above(cut, add_top), (0, 0))
        else:
            strip = cut.crop((0, 0, width, 3)).resize((width, 1), Image.BOX)  # each column's own top colour
            canvas.paste(strip.resize((width, add_top)), (0, 0))
        canvas.paste(cut, (0, add_top))
        if mode == ["sky"]:  # soften the join
            seam = canvas.crop((0, add_top - 14, width, add_top + 14)).filter(ImageFilter.GaussianBlur(5))
            canvas.paste(seam, (0, add_top - 14))
        cut = canvas
    out = cut.resize((1200, 800), Image.LANCZOS)
    path = f"{OUT}/{name}-m-1200.webp"
    out.save(path, "WEBP", quality=88, method=6)
    top_edge = cut.crop((0, 0, width, 6)).resize((1, 1), Image.BOX).getpixel((0, 0))
    print(f"{name} (phone): {cut.size} -> 1200x800, {os.path.getsize(path)//1024} KB, top edge #{''.join(f'{c:02x}' for c in top_edge)}")
    for (bx, by, bw, bh) in buttons:
        x, y = bx - left, by + add_top
        assert 0 <= x and x + bw <= width and y + bh <= h, (name, "button outside the phone crop")
        print(f"   button: left {x / width * 100:.2f}, top {y / h * 100:.2f}, width {bw / width * 100:.2f}, height {bh / h * 100:.2f}")

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
