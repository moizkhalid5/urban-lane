"""
Copies the full-screen phone banners (and the Outlet and Beauty desktop banners) from Banners/ (not
committed) to public/images/banners as lossless WebP: every pixel is kept, no resizing, no cropping.
A banner with its own logo right at the top gets soft sky added above it (SKY_ABOVE), so that logo doesn't
land on the see-through menu's logo.
Each file name carries a version, because images are cached for a year: replacing artwork needs a new name.

Run from the project root:  python scripts/build_phone_banners.py
Where they are used: src/lib/collection-heroes.ts.
"""
import random
from PIL import Image, ImageFilter

SRC = "Banners/"
CHATGPT = "mobile view/ChatGPT Image Oct 30, 2026, "
OUT = "public/images/banners"

FILES = {
    "home/urban-lane-phone-v1": "06_34_34 PM-3.png",
    "home/men-winter-phone-v1": "06_34_29 PM-1.png",
    "home/women-phone-v1": "06_34_38 PM-5.png",
    "home/kids-summer-phone-v1": "06_34_31 PM-2.png",
    "home/sale-season-phone-v1": "06_34_36 PM-4.png",
    "men-phone-v2": "06_47_08 PM-3.png",
    "women-phone-v1": "06_47_05 PM-1.png",
    "kids-phone-v1": "06_47_11 PM-4.png",
    "outlet-phone-v1": "06_47_14 PM-5.png",
    "outlet-desktop-v1": "06_47_15 PM-6.png",
    "beauty-phone-v1": "beauty/urban_lane_beauty_mobile_no_nav.png",
    "beauty-desktop-v1": "beauty/urban_lane_beauty_desktop_no_nav.png",
}

# name: px of sky to add above
SKY_ABOVE = {"men-phone-v2": 110}


def sky_above(im, add):
    """The top edge's own colours carried upwards, smoothed, with faint grain; the join is softened."""
    width = im.size[0]
    strip = im.crop((0, 0, width, 12)).resize((width, 1), Image.BOX).filter(ImageFilter.GaussianBlur(40))
    sky = strip.resize((width, add))
    px = sky.load()
    random.seed(1)
    for y in range(add):
        for x in range(width):
            n = random.randint(-2, 2)
            px[x, y] = tuple(c + n for c in px[x, y])
    out = Image.new("RGB", (width, im.size[1] + add))
    out.paste(sky.filter(ImageFilter.GaussianBlur(1)), (0, 0))
    out.paste(im, (0, add))
    seam = out.crop((0, add - 10, width, add + 10)).filter(ImageFilter.GaussianBlur(4))
    out.paste(seam, (0, add - 10))
    return out


for name, src in FILES.items():
    im = Image.open(SRC + (src if "/" in src else CHATGPT + src)).convert("RGB")
    if name in SKY_ABOVE:
        im = sky_above(im, SKY_ABOVE[name])
    im.save(f"{OUT}/{name}.webp", lossless=True, quality=100, method=6)
    print(name, im.size)
