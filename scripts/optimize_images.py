"""
Optimize product images in place for web + git.

Resizes each image so its longest side is <= MAX_PX and recompresses it, KEEPING
the same filename and format (so the database image URLs still match). Run:

    python scripts/optimize_images.py
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "public", "uploads", "products")
MAX_PX = 1200

def human(n):
    return f"{n/1048576:.1f} MB"

before = after = 0
count = 0
for root, _, files in os.walk(DIR):
    for fn in files:
        path = os.path.join(root, fn)
        ext = os.path.splitext(fn)[1].lower()
        if ext not in (".png", ".jpg", ".jpeg", ".webp"):
            continue
        before += os.path.getsize(path)
        try:
            im = Image.open(path)
            im.load()
            w, h = im.size
            scale = min(1.0, MAX_PX / max(w, h))
            if scale < 1.0:
                im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)

            if ext in (".jpg", ".jpeg"):
                if im.mode not in ("RGB", "L"):
                    im = im.convert("RGB")
                im.save(path, "JPEG", quality=82, optimize=True, progressive=True)
            elif ext == ".webp":
                im.save(path, "WEBP", quality=82, method=6)
            else:  # .png — flatten fully-opaque RGBA to RGB so optimize helps
                if im.mode == "RGBA":
                    alpha = im.getchannel("A")
                    if alpha.getextrema()[0] == 255:  # fully opaque
                        im = im.convert("RGB")
                im.save(path, "PNG", optimize=True)
            count += 1
        except Exception as e:
            print(f"  skip {path}: {e}")
        after += os.path.getsize(path)

print(f"Optimized {count} images")
print(f"Before: {human(before)}  ->  After: {human(after)}  ({100*after/before:.0f}%)")
