"""
Additive catalogue import (Sept 2026 image drop).

Unlike build_import.py, this NEVER wipes public/uploads or the product table.

The master sheet often lists each size of a product as its own SKU row
(e.g. ABB08060-165-30 = Small, -56 = Medium, -34 = Large) and only names the
first row. Rows are therefore grouped into FAMILIES (SKU minus its last
"-segment"); unnamed rows inherit name/brand/category/colour from the named row
and become extra sizes of one product.

For every family:
  * already on the site  -> its missing sizes are queued as variant additions
  * not on the site      -> it becomes a new product if it has images + data

Images are matched from the new white-background folder by file name or by the
folder a file sits in, including short codes ("ABB09104 (1).png" matches sheet
SKU "ABB09104-109-35"). Optional manual matches/fields for items whose images
are not named by SKU live in prisma/data/catalog-overrides.json.

    python scripts/build_import_additions.py --existing <skus.txt> --live-variants <variants.tsv>           # dry run
    python scripts/build_import_additions.py --existing <skus.txt> --live-variants <variants.tsv> --apply   # copy + optimize images

Then:  npx tsx prisma/import-additions.ts
"""
import os, re, json, glob, argparse
from collections import defaultdict, OrderedDict
import openpyxl
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "Urbanlane sales offline Mastersheet .xlsx")
OVERRIDES = os.path.join(ROOT, "prisma", "data", "catalog-overrides.json")
UPLOAD_DIR = os.path.join(ROOT, "public", "uploads", "products")
EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGES = 8
MAX_PX = 1200  # same as optimize_images.py
MIN_PX = 300   # skip web thumbnails (e.g. "-80x80") that would look blurry on a product page

ap = argparse.ArgumentParser()
ap.add_argument("--existing", required=True, help="text file, one live SKU per line")
ap.add_argument("--live-variants", required=True, help="TSV of live sku<TAB>size<TAB>color")
ap.add_argument("--image-folder", default="Urbanlane White background images-20260914T121235Z-1-001",
                help="downloaded drop folder (contains 'Urbanlane White background images')")
ap.add_argument("--out", default=os.path.join("prisma", "import-additions.json"), help="JSON written by --apply")
ap.add_argument("--hold", default="", help="comma-separated SKUs to leave out of this run (e.g. price still to confirm)")
ap.add_argument("--apply", action="store_true", help="copy + optimize images into public/uploads")
ap.add_argument("--report", help="write a JSON report here")
args = ap.parse_args()

IMAGE_FOLDER = os.path.join(ROOT, args.image_folder)
OUT_JSON = os.path.join(ROOT, args.out)
DROP_ROOT = os.path.join(IMAGE_FOLDER, "Urbanlane White background images")  # override image globs are relative to this

with open(args.existing, encoding="utf-8-sig") as f:
    existing = {l.strip() for l in f if l.strip()}
live_variants = defaultdict(set)
with open(args.live_variants, encoding="utf-8-sig") as f:
    for line in f:
        parts = (line.rstrip("\n").split("\t") + ["", ""])[:3]
        live_variants[parts[0].strip()].add((parts[1].strip().lower(), parts[2].strip().lower()))
overrides = json.load(open(OVERRIDES, encoding="utf-8")) if os.path.exists(OVERRIDES) else {}
held = {s.strip() for s in args.hold.split(",") if s.strip()}

# ---------------------------------------------------------------- image index
def norm(s: str) -> str:
    s = s.lower()
    s = re.sub(r"-?photoroom", "", s)
    s = re.sub(r"\(\d+\)", "", s)
    return re.sub(r"[^a-z0-9]", "", s)

def dedup_key(basename: str) -> str:
    s = basename.lower()
    s = re.sub(r"-?photoroom", "", s)
    return re.sub(r"[^a-z0-9()]", "", s)

def tokens(raw: str):
    return [t.lstrip("0") for t in re.split(r"[^a-z0-9]+", raw) if t]

def canon(code: str) -> str:
    return code.replace("abb-", "abb")

def name_matches(raw: str, sku_lower: str, sku_norm: str) -> bool:
    """True if `raw` (a file or folder name) refers to this SKU."""
    raw_n = norm(raw)
    if raw_n == sku_norm or raw_n.lstrip("0") == sku_norm.lstrip("0"):
        return True
    for cand in (raw, raw.lstrip("0")):
        if cand.startswith(sku_lower) and (len(cand) == len(sku_lower) or not cand[len(sku_lower)].isalnum()):
            return True
    # short style code on the image, full style-colour-size SKU in the sheet: "abb09104 (1)" -> "ABB09104-109-35"
    lead = re.sub(r"-?photoroom.*$", "", re.split(r"[\s(_]", raw.strip())[0])
    if len(norm(lead)) >= 6 and any(c.isdigit() for c in lead) and canon(sku_lower).startswith(canon(lead) + "-"):
        return True
    # SKU embedded later in a descriptive name, e.g. "Wet-n-Wild-Blush-E3292-Fantastic" (distinctive codes only)
    if len(sku_norm) >= 5 and any(c.isdigit() for c in sku_norm) and re.fullmatch(r"[a-z0-9]+", sku_lower):
        return sku_norm.lstrip("0") in tokens(raw)
    return False

images = []  # (path, file_base_lower, [ancestor folder names lower])
for r, _, files in os.walk(IMAGE_FOLDER):
    rel_dirs = os.path.relpath(r, IMAGE_FOLDER).split(os.sep)
    for fn in files:
        if os.path.splitext(fn)[1].lower() in EXTS:
            base = os.path.splitext(fn)[0].lower()
            images.append((os.path.join(r, fn), base, [d.lower() for d in rel_dirs if d != "."]))

def match_paths(sku: str):
    sn = norm(sku)
    if len(sn) < 4 or not any(c.isdigit() for c in sn):  # "BURTON", "New Look"... are brand label rows, not products
        return []
    skl = sku.lower()
    return [path for path, base, dirs in images
            if name_matches(base, skl, sn) or any(name_matches(d, skl, sn) for d in dirs)]

def pick_images(paths):
    """Collapse duplicate exports of the same shot (keep the largest) and cap."""
    groups = defaultdict(list)
    for p in dict.fromkeys(paths):
        with Image.open(p) as im:
            if max(im.size) < MIN_PX:
                continue
        groups[dedup_key(os.path.splitext(os.path.basename(p))[0])].append(p)
    return [max(groups[k], key=os.path.getsize) for k in sorted(groups)][:MAX_IMAGES]

# ---------------------------------------------------------------- mappings
BRAND_ALIASES = {
    "dabenhams": "Debenhams", "tu clothing": "Tu Clothing", "crew": "Crew Clothing",
    "next": "Next", "h&m": "H&M", "river island": "River Island", "new look": "New Look",
    "hype": "Hype", "asos": "ASOS", "burton": "Burton", "reebok": "Reebok",
    "adidas": "Adidas", "hollister": "Hollister", "nyx": "NYX", "gap": "GAP", "other": None,
    "maybelline new york": "Maybelline", "maybelline": "Maybelline", "loreal": "L'Oreal", "l'oreal": "L'Oreal",
    "l'oreal paris": "L'Oreal", "rimmel london": "Rimmel", "max factory": "Max Factor", "sleek makeup": "Sleek",
    "covergirl": "CoverGirl", "barry m": "Barry M",
}
# When the Brand cell is blank/OTHER, the brand is the start of the Item Name.
BRAND_FROM_TITLE = [
    ("dorothy perkins", "Dorothy Perkins"), ("racing green", "Racing Green"), ("brave soul", "Brave Soul"),
    ("love & roses", "Love & Roses"), ("ann summers", "Ann Summers"), ("david barry", "David Barry"),
    ("lee cooper", "Lee Cooper"), ("nasty gal", "Nasty Gal"), ("threadbare", "Threadbare"),
    ("principles", "Principles"), ("bisbigli", "Bisbigli"), ("oysho", "Oysho"), ("ellos", "Ellos"),
    ("oasis", "Oasis"), ("zara", "Zara"), ("faith", "Faith"), ("next", "Next"), ("m&s", "M&S"), ("l&s", "L&S"),
    ("burton", "Burton"), ("debenhams", "Debenhams"), ("maybelline", "Maybelline"), ("rimmel", "Rimmel"),
    ("max factor", "Max Factor"), ("l'oreal", "L'Oreal"), ("loreal", "L'Oreal"), ("nyx", "NYX"),
    ("bourjois", "Bourjois"), ("miss sporty", "Miss Sporty"), ("sleek", "Sleek"), ("barry m", "Barry M"),
]
def clean_brand(v):
    if not v: return None
    s = str(v).strip()
    if not s or s.lower() == "none": return None
    return BRAND_ALIASES.get(s.lower(), s.title() if s.isupper() else s)

def brand_from_title(title):
    t = (title or "").strip().lower()
    for prefix, name in BRAND_FROM_TITLE:
        if t.startswith(prefix + " "):
            return name
    return None

def map_categories(v, hint=None):
    """Top-level category slugs. 'Unisex' goes under both Men and Women."""
    s = (str(v).strip().lower() if v else "")
    if s == "none": s = ""
    if s.startswith("unisex"): return ["men", "women"]
    if s.startswith("women"): return ["women"]
    if s.startswith("men"): return ["men"]
    if any(k in s for k in ("girl", "boy", "baby", "kid")): return ["kids"]
    if any(k in s for k in ("health", "beauty", "cosmetic")): return ["beauty"]
    if "jewel" in s: return ["jewellery"]
    h = (hint or "").lower()
    if not s and any(k in h for k in ("newborn", "baby")): return ["kids"]
    return []

# ---------------------------------------------------------------- read sheet
wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
ws = wb["Master sheet-v1"]
it = ws.iter_rows(min_row=1, values_only=True)
hdr = {}
for i, h in enumerate(next(it)):
    if h and str(h).strip() not in hdr: hdr[str(h).strip()] = i
def cell(row, name):
    i = hdr.get(name)
    return row[i] if i is not None and i < len(row) else None

by_sku = OrderedDict()
for row in it:
    sku = cell(row, "Product SKU")
    if sku is None or not str(sku).strip():
        continue
    by_sku.setdefault(str(sku).strip(), []).append(row)

def to_int(v):
    try: return int(round(float(v)))
    except (TypeError, ValueError): return None

def val(v):
    return str(v).strip() if v is not None and str(v).strip() and str(v).strip().lower() != "none" else None

def safe_dir(sku):
    return re.sub(r"[^A-Za-z0-9_-]", "-", sku)

def family_key(sku):
    """Style-colour key: 'ABB08060-165-30' -> 'ABB08060-165'. SKUs with fewer than two dashes are their own family."""
    if overrides.get(sku, {}).get("family"):  # e.g. foundation shades listed as separate SKUs
        return family_key(overrides[sku]["family"])
    s = sku.replace("ABB-", "ABB")
    return s.rsplit("-", 1)[0] if s.count("-") >= 2 else s

families = OrderedDict()
for sku in by_sku:
    families.setdefault(family_key(sku), []).append(sku)

def copy_optimized(src, dest):
    """Copy an image, resizing to MAX_PX and recompressing exactly like optimize_images.py."""
    ext = os.path.splitext(dest)[1].lower()
    im = Image.open(src); im.load()
    w, h = im.size
    scale = min(1.0, MAX_PX / max(w, h))
    if scale < 1.0:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    if ext in (".jpg", ".jpeg"):
        if im.mode not in ("RGB", "L"): im = im.convert("RGB")
        im.save(dest, "JPEG", quality=82, optimize=True, progressive=True)
    elif ext == ".webp":
        im.save(dest, "WEBP", quality=82, method=6)
    else:
        if im.mode == "RGBA" and im.getchannel("A").getextrema()[0] == 255:
            im = im.convert("RGB")
        im.save(dest, "PNG", optimize=True)

# ---------------------------------------------------------------- build
products, variant_additions, skipped = [], [], defaultdict(list)
claimed_by = defaultdict(set)  # image path -> family keys that matched it
plans, multi_live, name_conflicts = [], [], []

for key, members in families.items():
    # named rows first so they act as the parent
    members = sorted(members, key=lambda m: 0 if any(val(cell(r, "Item Name")) for r in by_sku[m]) or overrides.get(m, {}).get("title") else 1)
    ov = {}
    for m in reversed(members):
        ov.update(overrides.get(m, {}))
    fam_rows = [r for m in members for r in by_sku[m]]

    def first(name):
        for r in fam_rows:
            v = val(cell(r, name))
            if v: return v
        return None

    raw_paths = [p for m in members for p in match_paths(m)]
    for m in members:
        for pat in overrides.get(m, {}).get("images", []):
            hits = sorted(os.path.normpath(p) for p in glob.glob(os.path.join(DROP_ROOT, pat)))  # same separators as the os.walk index
            if not hits:
                print(f"  ! override image pattern for {m} matched nothing: {pat}")
            raw_paths += hits
    imgs = pick_images(raw_paths)
    for p in raw_paths: claimed_by[p].add(key)

    names = {val(cell(r, "Item Name")).lower() for r in fam_rows if val(cell(r, "Item Name"))}
    if len(members) > 1 and len(names) > 1:
        name_conflicts.append({"family": key, "skus": members, "names": sorted(names)})

    parent_colour = ov.get("color") or first("Colour")
    variant_rows = []
    seen = set()
    for m in members:
        for r in by_sku[m]:
            size = val(cell(r, "Size"))
            colour = overrides.get(m, {}).get("color") or val(cell(r, "Colour")) or parent_colour  # an SKU's own override corrects sheet typos
            stock = to_int(cell(r, "Actual Stock"))
            if stock is None: stock = to_int(cell(r, "Quantity"))
            if stock is None or stock < 0: stock = 0
            if (size, colour) in seen: continue
            seen.add((size, colour))
            variant_rows.append({"size": size, "color": colour, "stock": stock, "fromSku": m})

    live_members = [m for m in members if m in existing]
    if len(live_members) > 1:
        multi_live.append({"family": key, "live": live_members}); continue
    if live_members:
        target = live_members[0]
        have = live_variants.get(target, set())
        missing = [v for v in variant_rows
                   if v["fromSku"] != target and ((v["size"] or "").lower(), (v["color"] or "").lower()) not in have
                   and ((v["size"] or "").lower(), "") not in have]
        if missing:
            variant_additions.append({"sku": target, "variants": missing})
        continue

    # ---- new product
    sku = members[0]
    description = ov.get("description") or first("Description")
    sheet_brand = clean_brand(ov.get("brand") or first("Brand"))
    title = ov.get("title") or first("Item Name")
    notes = []
    if not title and description and sheet_brand:
        title = f"{sheet_brand} {description}"; notes.append("title from description")
    brand = sheet_brand or brand_from_title(title)
    if brand and not sheet_brand: notes.append("brand from title")
    categories = ov.get("categories") or map_categories(first("Category"), hint=f"{title} {description}")
    price_raw = ov.get("price") or next((p for p in (to_int(cell(r, "Retail price on website Rs")) for r in fam_rows) if p), None)
    status_raw = (val(cell(by_sku[sku][0], "Product Status")) or first("Product Status") or "").lower()
    if ov: notes.append("manual match")
    if len(members) > 1: notes.append(f"sizes merged from {len(members)} SKUs")
    info = {"sku": sku, "family": members, "title": title, "brand": first("Brand"), "category": first("Category"), "images": len(imgs),
            "imagePaths": [os.path.relpath(p, IMAGE_FOLDER) for p in imgs]}

    if sku in held:
        skipped["held"].append(info); continue
    if not imgs:
        skipped["no_image"].append(info); continue
    reason = (not title and "no_title") or (not brand and "no_brand") or (not categories and "no_category") \
        or (not price_raw and "no_price") or ("private" in status_raw and "private") or None
    if reason:
        skipped[reason].append(info); continue

    plans.append((sku, imgs))
    products.append({
        "sku": sku, "title": title, "description": description, "brand": brand,
        "categories": categories, "priceCents": int(price_raw) * 100,
        "variants": [{k: v[k] for k in ("size", "color", "stock")} for v in variant_rows] or [{"size": None, "color": None, "stock": 0}],
        "images": [f"/uploads/products/{safe_dir(sku)}/{i+1}{os.path.splitext(s)[1].lower()}" for i, s in enumerate(imgs)],
        "familySkus": members, "notes": notes,
        "sources": [os.path.relpath(s, DROP_ROOT) for s in imgs],
    })

collisions = {p: sorted(k) for p, k in claimed_by.items() if len(k) > 1}

# ---------------------------------------------------------------- apply
if args.apply:
    new_paths = {p for _, imgs in plans for p in imgs}
    bad = {p: k for p, k in collisions.items() if p in new_paths}
    if bad:
        raise SystemExit(f"Refusing to apply: {len(bad)} images used by a new product also match another family (see --report).")
    for sku, _ in plans:
        if os.path.exists(os.path.join(UPLOAD_DIR, safe_dir(sku))):
            raise SystemExit(f"Refusing to overwrite existing image folder for {sku}")
    for sku, imgs in plans:
        folder = os.path.join(UPLOAD_DIR, safe_dir(sku))
        os.makedirs(folder)
        for idx, src in enumerate(imgs):
            copy_optimized(src, os.path.join(folder, f"{idx+1}{os.path.splitext(src)[1].lower()}"))
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump({"products": products, "variantAdditions": variant_additions}, f, ensure_ascii=False, indent=2)

unmatched = defaultdict(list)
for path, base, dirs in images:
    if path not in claimed_by:
        unmatched[os.path.relpath(os.path.dirname(path), IMAGE_FOLDER)].append(os.path.basename(path))

# ---------------------------------------------------------------- report
def count_by(key):
    c = defaultdict(int)
    for p in products:
        for v in (p[key] if isinstance(p[key], list) else [p[key]]): c[v] += 1
    return dict(sorted(c.items(), key=lambda x: -x[1]))

print(f"{'APPLIED' if args.apply else 'DRY RUN'}")
print(f"Sheet SKUs: {len(by_sku)} in {len(families)} families | live on site: {len(existing)} | images in drop: {len(images)}")
print(f"NEW PRODUCTS TO ADD: {len(products)}  (variants {sum(len(p['variants']) for p in products)}, images {sum(len(p['images']) for p in products)})")
print("  by category:", count_by("categories"))
print("  by brand:   ", count_by("brand"))
print(f"SIZES TO ADD TO LIVE PRODUCTS: {sum(len(v['variants']) for v in variant_additions)} across {len(variant_additions)} products")
print("Skipped families:", {k: len(v) for k, v in sorted(skipped.items())})
print(f"Families with 2+ live SKUs (left alone): {len(multi_live)} | families whose rows carry different names: {len(name_conflicts)}")
print(f"Images matched to more than one family: {len(collisions)}")
print(f"Images in drop not matched to anything: {sum(len(v) for v in unmatched.values())} in {len(unmatched)} folders")

if args.report:
    with open(args.report, "w", encoding="utf-8") as f:
        json.dump({"products": products, "variantAdditions": variant_additions, "skipped": skipped,
                   "unmatched": unmatched, "collisions": collisions, "multiLive": multi_live,
                   "nameConflicts": name_conflicts}, f, ensure_ascii=False, indent=2)
