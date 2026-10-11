"""
Build uploads-bundle.zip with FORWARD-SLASH paths so it extracts into proper
nested folders on Linux/Hostinger (PowerShell's Compress-Archive uses
backslashes, which Linux treats as literal filename characters). Run:

    python scripts/build_uploads_zip.py
"""
import os, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "public", "uploads")
SRC = os.path.join(BASE, "products")
OUT = os.path.join(ROOT, "uploads-bundle.zip")

count = 0
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, _, files in os.walk(SRC):
        for f in files:
            full = os.path.join(root, f)
            arc = os.path.relpath(full, BASE).replace(os.sep, "/")  # forward slashes
            zf.write(full, arc)
            count += 1

size_mb = os.path.getsize(OUT) / 1048576
print(f"Wrote {OUT} with {count} files ({size_mb:.0f} MB)")
# show a few entries to prove forward slashes
with zipfile.ZipFile(OUT) as zf:
    for name in zf.namelist()[:4]:
        print("  entry:", name)
