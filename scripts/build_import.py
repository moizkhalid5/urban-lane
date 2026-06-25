"""
Stage 1 of the catalogue import.

Reads the Urbanlane master sheet, matches each Product SKU to image files in the
two image folders (whole-token match), copies the matched images into
public/uploads/products/<sku>/, and writes prisma/import-data.json.

NO database writes happen here. Run:  python scripts/build_import.py
"""
import os, re, json, shutil, hashlib
from collections import defaultdict, OrderedDict
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "Urbanlane sales offline Mastersheet .xlsx")
IMAGE_FOLDERS = [
    os.path.join(ROOT, "White background images-20260623T111837Z-3-001"),
    os.path.join(ROOT, "Urbanlane stock images-20260623T112809Z-3-001"),
]
OUT_JSON = os.path.join(ROOT, "prisma", "import-data.json")
UPLOAD_DIR = os.path.join(ROOT, "public", "uploads", "products")
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_IMAGES = 8

# ---------------------------------------------------------------- image index
def norm(s: str) -> str:
    """Aggressive normalization for SKU<->image MATCHING."""
    s = s.lower()
    s = re.sub(r"-?photoroom", "", s)
    s = re.sub(r"\(\d+\)", "", s)
    return re.sub(r"[^a-z0-9]", "", s)

def dedup_key(basename: str) -> str:
    """Key for collapsing duplicate EXPORTS of the same image, while keeping
    distinct angle shots (which use ` (2)`, `(1)` numbering) separate."""
    s = basename.lower()
    s = re.sub(r"-?photoroom", "", s)   # drop the re-export markers
    return re.sub(r"[^a-z0-9()]", "", s)  # keep parenthetical numbering

images = []
for folder in IMAGE_FOLDERS:
    for r, _, files in os.walk(folder):
        for fn in files:
            if os.path.splitext(fn)[1].lower() in EXTS:
                images.append(os.path.join(r, fn))

img_index = []  # (norm_full, raw_lower, path)
for p in images:
    b = os.path.splitext(os.path.basename(p))[0]
    img_index.append((norm(b), b.lower(), p))

def match_images(sku: str):
    sn = norm(sku)
    if len(sn) < 4:
        return []
    skl = sku.lower()
    hits = []
    for nf, raw, path in img_index:
        if nf == sn:
            hits.append(path)
        elif nf.startswith(sn) and raw.startswith(skl) and (len(raw) == len(skl) or not raw[len(skl)].isalnum()):
            hits.append(path)
    # de-duplicate near-identical exports: group by dedup key, keep largest file
    groups = defaultdict(list)
    for p in hits:
        groups[dedup_key(os.path.splitext(os.path.basename(p))[0])].append(p)
    chosen = []
    for key in sorted(groups):
        best = max(groups[key], key=lambda p: os.path.getsize(p))
        chosen.append(best)
    return chosen[:MAX_IMAGES]

# ---------------------------------------------------------------- mappings
BRAND_ALIASES = {
    "dabenhams": "Debenhams", "tu clothing": "Tu Clothing", "crew": "Crew Clothing",
    "next": "Next", "h&m": "H&M", "river island": "River Island", "new look": "New Look",
    "hype": "Hype", "asos": "ASOS", "burton": "Burton", "reebok": "Reebok",
    "adidas": "Adidas", "hollister": "Hollister", "nyx": "NYX", "other": None,
}
def clean_brand(v):
    if not v: return None
    s = str(v).strip()
    if not s or s.lower() == "none": return None
    return BRAND_ALIASES.get(s.lower(), s.title() if s.isupper() else s)

def map_category(v):
    if not v: return None
    s = str(v).strip().lower()
    if not s or s == "none": return None
    if s.startswith("women") or s == "women": return "women"
    if s.startswith("men"):  # includes "men & women", "men's-..."
        return "men"
    if any(k in s for k in ("girl", "boy", "baby", "kid")): return "kids"
    if any(k in s for k in ("health", "beauty", "cosmetic")): return "beauty"
    if "jewel" in s: return "jewellery"
    return None

# ---------------------------------------------------------------- read sheet
wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
ws = wb["Master sheet-v1"]
it = ws.iter_rows(min_row=1, values_only=True)
hdr = {}
for i, h in enumerate(next(it)):
    if h: hdr[str(h).strip()] = i
def cell(row, name):
    i = hdr.get(name)
    return row[i] if i is not None and i < len(row) else None

# group rows by Product SKU
by_sku = OrderedDict()
for row in it:
    sku = cell(row, "Product SKU")
    if sku is None or not str(sku).strip():
        continue
    sku = str(sku).strip()
    by_sku.setdefault(sku, []).append(row)

# ---------------------------------------------------------------- build products
def to_int(v):
    try: return int(round(float(v)))
    except (TypeError, ValueError): return None

def safe_dir(sku):
    return re.sub(r"[^A-Za-z0-9_-]", "-", sku)

products = []
skipped = defaultdict(list)

if os.path.isdir(UPLOAD_DIR):
    shutil.rmtree(UPLOAD_DIR)
os.makedirs(UPLOAD_DIR, exist_ok=True)

for sku, rows in by_sku.items():
    imgs = match_images(sku)
    if not imgs:
        skipped["no_image"].append(sku); continue

    # aggregate fields across the SKU's rows (first non-empty)
    def first(name):
        for r in rows:
            v = cell(r, name)
            if v is not None and str(v).strip() and str(v).strip().lower() != "none":
                return str(v).strip()
        return None

    title = first("Item Name")
    brand = clean_brand(first("Brand"))
    category = map_category(first("Category"))
    price_raw = None
    for r in rows:
        p = to_int(cell(r, "Retail price on website Rs"))
        if p: price_raw = p; break
    status_raw = (first("Product Status") or "").lower()

    if not title:
        skipped["no_title"].append(sku); continue
    if not brand:
        skipped["no_brand"].append(sku); continue
    if not category:
        skipped["no_category"].append(sku); continue
    if not price_raw:
        skipped["no_price"].append(sku); continue
    if "private" in status_raw:
        skipped["private"].append(sku); continue

    # variants from distinct (size, colour)
    seen = set(); variants = []
    for r in rows:
        size = cell(r, "Size"); colour = cell(r, "Colour")
        size = str(size).strip() if size and str(size).strip().lower() != "none" else None
        colour = str(colour).strip() if colour and str(colour).strip().lower() != "none" else None
        stock = to_int(cell(r, "Actual Stock"))
        if stock is None: stock = to_int(cell(r, "Quantity"))
        if stock is None or stock < 0: stock = 0
        key = (size, colour)
        if key in seen:
            continue
        seen.add(key)
        variants.append({"size": size, "color": colour, "stock": stock})
    if not variants:
        variants = [{"size": None, "color": None, "stock": 0}]

    # copy images
    dest_rel = []
    folder = os.path.join(UPLOAD_DIR, safe_dir(sku))
    os.makedirs(folder, exist_ok=True)
    for idx, src in enumerate(imgs):
        ext = os.path.splitext(src)[1].lower()
        fname = f"{idx+1}{ext}"
        shutil.copy2(src, os.path.join(folder, fname))
        dest_rel.append(f"/uploads/products/{safe_dir(sku)}/{fname}")

    description = first("Description")
    products.append({
        "sku": sku,
        "title": title,
        "description": description,
        "brand": brand,
        "category": category,
        "priceCents": price_raw * 100,
        "variants": variants,
        "images": dest_rel,
    })

os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
with open(OUT_JSON, "w", encoding="utf-8") as f:
    json.dump(products, f, ensure_ascii=False, indent=2)

# ---------------------------------------------------------------- report
print(f"PRODUCTS BUILT: {len(products)}")
print(f"TOTAL VARIANTS: {sum(len(p['variants']) for p in products)}")
print(f"TOTAL IMAGES:   {sum(len(p['images']) for p in products)}")
print("\nBY CATEGORY:", dict((c, sum(1 for p in products if p['category']==c)) for c in sorted(set(p['category'] for p in products))))
print("BY BRAND:", dict(sorted(((b, sum(1 for p in products if p['brand']==b)) for b in set(p['brand'] for p in products)), key=lambda x:-x[1])))
print("\nSKIPPED:")
for reason, lst in sorted(skipped.items()):
    print(f"  {reason}: {len(lst)}")
print(f"\nWrote {OUT_JSON}")
