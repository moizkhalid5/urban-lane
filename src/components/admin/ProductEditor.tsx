"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { saveProduct } from "@/app/actions/admin-products";

type BrandOpt = { id: string; name: string };
type CatOpt = { id: string; name: string; level: number };

type VariantRow = {
  id?: string;
  size: string;
  color: string;
  colorHex: string;
  sku: string;
  price: string; // major units, optional
  stock: string;
  image: string;
};

export type ProductEditorData = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  details: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  brandId: string;
  gender: string;
  productType: string;
  material: string;
  price: string;
  compareAt: string;
  cost: string;
  sku: string;
  barcode: string;
  lowStockThreshold: string;
  isFeatured: boolean;
  isOutlet: boolean;
  tags: string;
  seoTitle: string;
  seoDescription: string;
  categoryIds: string[];
  images: { url: string; alt?: string }[];
  variants: VariantRow[];
};

const toCents = (major: string) => (major.trim() === "" ? null : Math.round(parseFloat(major) * 100));

export function ProductEditor({
  brands,
  categories,
  initial,
}: {
  brands: BrandOpt[];
  categories: CatOpt[];
  initial: ProductEditorData;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProductEditorData>(initial);
  const [uploading, setUploading] = useState(false);
  const [missing, setMissing] = useState<Set<string>>(new Set()); // photo URLs whose file no longer exists

  const set = <K extends keyof ProductEditorData>(key: K, value: ProductEditorData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  function toggleCategory(id: string) {
    setData((d) => ({
      ...d,
      categoryIds: d.categoryIds.includes(id) ? d.categoryIds.filter((c) => c !== id) : [...d.categoryIds, id],
    }));
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.url) {
        setData((d) => ({ ...d, images: [...d.images, { url: json.url, alt: d.title }] }));
      } else {
        setError(json.error ?? `Upload of "${file.name}" failed (error ${res.status}). Please try again.`);
      }
    } catch {
      setError(`Upload of "${file.name}" failed: no connection to the server. Please try again.`);
    } finally {
      setUploading(false);
    }
  }

  function addVariant() {
    setData((d) => ({ ...d, variants: [...d.variants, { size: "", color: "", colorHex: "", sku: "", price: "", stock: "0", image: "" }] }));
  }
  function updateVariant(i: number, patch: Partial<VariantRow>) {
    setData((d) => ({ ...d, variants: d.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) }));
  }
  function removeVariant(i: number) {
    setData((d) => ({ ...d, variants: d.variants.filter((_, idx) => idx !== i) }));
  }

  function submit() {
    setError(null);
    const payload = {
      title: data.title,
      slug: data.slug,
      description: data.description,
      details: data.details,
      material: data.material,
      status: data.status,
      brandId: data.brandId || null,
      gender: data.gender,
      productType: data.productType,
      priceCents: toCents(data.price) ?? 0,
      compareAtCents: toCents(data.compareAt),
      costCents: toCents(data.cost),
      sku: data.sku,
      barcode: data.barcode,
      lowStockThreshold: parseInt(data.lowStockThreshold || "5", 10),
      isFeatured: data.isFeatured,
      isOutlet: data.isOutlet,
      tags: data.tags.split(",").map((t) => t.trim()).filter(Boolean),
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      categoryIds: data.categoryIds,
      images: data.images,
      variants: data.variants.map((v) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex,
        sku: v.sku,
        priceCents: toCents(v.price),
        stock: parseInt(v.stock || "0", 10),
        image: v.image,
      })),
    };

    start(async () => {
      const res = await saveProduct(payload, data.id);
      if (res.ok) router.push("/admin/products");
      else setError(res.message ?? "Could not save product.");
    });
  }

  return (
    <div className="space-y-8">
      {error && <p className="border border-sale bg-sale/5 p-3 text-sm text-sale">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* main column */}
        <div className="space-y-8">
          <Section title="Basics">
            <Text label="Title" value={data.title} onChange={(v) => set("title", v)} />
            <Text label="Slug (optional — auto from title)" value={data.slug} onChange={(v) => set("slug", v)} />
            <Area label="Description" value={data.description} onChange={(v) => set("description", v)} />
            <Area label="Details (one per line)" value={data.details} onChange={(v) => set("details", v)} />
          </Section>

          <Section title="Media">
            <div className="flex flex-wrap gap-3">
              {data.images.map((img, i) => (
                <div key={i} className="relative h-24 w-20 overflow-hidden border border-line">
                  {missing.has(img.url) ? (
                    <span className="flex h-full w-full items-center justify-center bg-sale/10 p-1 text-center text-[11px] font-medium leading-tight text-sale">
                      Missing, remove &amp; re-upload
                    </span>
                  ) : (
                    <Image
                      src={img.url}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                      onError={() => setMissing((m) => new Set(m).add(img.url))}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => set("images", data.images.filter((_, idx) => idx !== i))}
                    className="absolute right-0 top-0 bg-ink px-1.5 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="flex h-24 w-20 cursor-pointer items-center justify-center border border-dashed border-line text-xs text-ink-muted hover:border-ink">
                {uploading ? "…" : "+ Add"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = [...(e.target.files ?? [])];
                    e.target.value = "";
                    for (const file of files) await uploadImage(file); // one at a time, in the order chosen
                  }}
                />
              </label>
            </div>
          </Section>

          <Section title="Variants">
            <div className="space-y-3">
              {data.variants.map((v, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 border border-line p-3 sm:grid-cols-6">
                  <Mini label="Size" value={v.size} onChange={(x) => updateVariant(i, { size: x })} />
                  <Mini label="Colour" value={v.color} onChange={(x) => updateVariant(i, { color: x })} />
                  <Mini label="Hex" value={v.colorHex} onChange={(x) => updateVariant(i, { colorHex: x })} />
                  <Mini label="SKU" value={v.sku} onChange={(x) => updateVariant(i, { sku: x })} />
                  <Mini label="Price" value={v.price} onChange={(x) => updateVariant(i, { price: x })} placeholder="base" />
                  <Mini label="Stock" value={v.stock} onChange={(x) => updateVariant(i, { stock: x })} />
                  <button type="button" onClick={() => removeVariant(i)} className="col-span-2 text-left text-xs text-sale hover:underline sm:col-span-6">
                    Remove variant
                  </button>
                </div>
              ))}
              <button type="button" onClick={addVariant} className="btn-ghost">+ Add variant</button>
              <p className="text-xs text-ink-muted">
                Leave size/colour empty for a single-variant product (customers won&apos;t be asked to choose).
              </p>
            </div>
          </Section>

          <Section title="SEO">
            <Text label="SEO title" value={data.seoTitle} onChange={(v) => set("seoTitle", v)} />
            <Area label="SEO description" value={data.seoDescription} onChange={(v) => set("seoDescription", v)} />
          </Section>
        </div>

        {/* sidebar */}
        <div className="space-y-8">
          <Section title="Status">
            <label className="label">Status</label>
            <select value={data.status} onChange={(e) => set("status", e.target.value as ProductEditorData["status"])} className="input">
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={data.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} className="h-4 w-4 accent-ink" />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={data.isOutlet} onChange={(e) => set("isOutlet", e.target.checked)} className="h-4 w-4 accent-ink" />
              Outlet / on sale
            </label>
          </Section>

          <Section title="Pricing (base currency)">
            <Text label="Price" value={data.price} onChange={(v) => set("price", v)} />
            <Text label="Compare-at price" value={data.compareAt} onChange={(v) => set("compareAt", v)} />
            <Text label="Cost (admin only)" value={data.cost} onChange={(v) => set("cost", v)} />
          </Section>

          <Section title="Organization">
            <label className="label">Brand</label>
            <select value={data.brandId} onChange={(e) => set("brandId", e.target.value)} className="input">
              <option value="">No brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <Text label="Gender / group" value={data.gender} onChange={(v) => set("gender", v)} />
            <Text label="Product type" value={data.productType} onChange={(v) => set("productType", v)} />
            <Text label="Material" value={data.material} onChange={(v) => set("material", v)} />
            <Text label="SKU" value={data.sku} onChange={(v) => set("sku", v)} />
            <Text label="Barcode" value={data.barcode} onChange={(v) => set("barcode", v)} />
            <Text label="Low-stock threshold" value={data.lowStockThreshold} onChange={(v) => set("lowStockThreshold", v)} />
            <Text label="Tags (comma separated)" value={data.tags} onChange={(v) => set("tags", v)} />
          </Section>

          <Section title="Categories">
            <div className="max-h-64 space-y-1 overflow-y-auto border border-line p-2 text-sm">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2" style={{ paddingLeft: c.level * 12 }}>
                  <input
                    type="checkbox"
                    checked={data.categoryIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                    className="h-3.5 w-3.5 accent-ink"
                  />
                  <span className={c.level === 0 ? "font-medium" : "text-ink-soft"}>{c.name}</span>
                </label>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-line bg-white py-4">
        <button type="button" onClick={() => router.push("/admin/products")} className="btn-ghost">Cancel</button>
        <button type="button" onClick={submit} disabled={pending || uploading} className="btn-primary">
          {pending ? "Saving…" : "Save product"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 font-medium">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input" />
    </div>
  );
}
function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className="input" />
    </div>
  );
}
function Mini({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink-muted">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full border border-line px-2 py-1.5 text-sm focus:border-ink focus:outline-none" />
    </div>
  );
}
