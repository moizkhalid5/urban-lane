import { prisma } from "@/lib/prisma";
import { parseTable } from "@/lib/table";

/**
 * Bulk review import for Admin → Reviews → Import: rows pasted from Excel (tab-separated) or a CSV file.
 * The first row holds column names; recognised names (any case) are listed in COLUMNS.
 */
export const COLUMNS = {
  product: ["product", "sku", "product sku", "urbanlane sku", "product name", "item name"],
  name: ["name", "customer", "customer name"],
  city: ["city"],
  rating: ["rating", "stars", "star"],
  body: ["review", "text", "comment", "review text", "feedback"],
  title: ["title", "review title"],
  date: ["date", "review date"],
  source: ["source", "received via", "via"],
  verified: ["verified", "verified buyer"],
  homepage: ["homepage", "show on homepage", "featured"],
} as const;

export const TEMPLATE_HEADER = ["SKU", "Name", "City", "Rating", "Review", "Title", "Date", "Source", "Verified", "Homepage"];

const SOURCES: Record<string, string> = {
  website: "WEBSITE",
  whatsapp: "WHATSAPP",
  instagram: "INSTAGRAM",
  insta: "INSTAGRAM",
  facebook: "FACEBOOK",
  fb: "FACEBOOK",
  "in person": "IN_STORE",
  "in store": "IN_STORE",
  store: "IN_STORE",
  shop: "IN_STORE",
  email: "EMAIL",
  daraz: "OTHER",
  other: "OTHER",
};

export type ImportRow = {
  line: number;
  productInput: string;
  product: { id: string; title: string; slug: string } | null; // null = store review (empty product cell)
  authorName: string;
  authorCity: string | null;
  rating: number;
  title: string | null;
  body: string;
  reviewedAt: string; // ISO
  source: string;
  verifiedPurchase: boolean;
  featured: boolean;
  error: string | null;
  duplicate: boolean;
};


function parseDate(raw: string): Date {
  const now = new Date();
  if (!raw) return now;
  let d: Date | null = null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // Pakistan/UK order: day/month/year
  if (iso) d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
  else if (dmy) {
    const y = Number(dmy[3]) < 100 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    d = new Date(y, Number(dmy[2]) - 1, Number(dmy[1]), 12);
  } else if (/^\d{5}$/.test(raw)) d = new Date(Math.round((Number(raw) - 25569) * 86_400_000)); // Excel date number
  else {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) d = new Date(t);
  }
  return !d || Number.isNaN(d.getTime()) || d > now ? now : d;
}

const yes = (v: string) => /^(y|yes|true|1|haan|han|✓)$/i.test(v.trim());

/** Parses the pasted table, matches each row to a product, and flags problems and duplicates. Nothing is saved. */
export async function prepareImport(text: string): Promise<{ rows: ImportRow[]; error: string | null }> {
  const table = parseTable(text);
  if (table.length < 2) return { rows: [], error: "Paste the header row and at least one review row." };
  if (table.length > 501) return { rows: [], error: "Import up to 500 reviews at a time." };

  const header = table[0].map((h) => h.toLowerCase().replace(/\s+/g, " "));
  const col = (key: keyof typeof COLUMNS) => header.findIndex((h) => (COLUMNS[key] as readonly string[]).includes(h));
  const idx = Object.fromEntries((Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]).map((k) => [k, col(k)])) as Record<keyof typeof COLUMNS, number>;
  const missing = (["name", "rating", "body"] as const).filter((k) => idx[k] < 0);
  if (missing.length) {
    return { rows: [], error: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.map((k) => ({ name: "Name", rating: "Rating", body: "Review" })[k]).join(", ")}. The first row must be the column names (see the template).` };
  }

  const products = await prisma.product.findMany({ select: { id: true, title: true, slug: true, sku: true } });
  const bySku = new Map(products.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase(), p]));
  const bySlug = new Map(products.map((p) => [p.slug.toLowerCase(), p]));
  const normTitle = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
  const byTitle = new Map<string, (typeof products)[number][]>();
  for (const p of products) byTitle.set(normTitle(p.title), [...(byTitle.get(normTitle(p.title)) ?? []), p]);
  /** The product, or a reason it couldn't be matched. Names shared by several products need the SKU instead. */
  const find = (raw: string): { product: (typeof products)[number] | null; problem: string | null } => {
    const v = raw.toLowerCase().trim();
    const firstToken = v.split(/\s+/)[0]; // "707-731 C8/R3 35R" (Urbanlane SKU) -> "707-731"
    const slug = v.replace(/^.*\/products\//, "").replace(/[?#].*$/, "");
    const direct = bySku.get(v) ?? bySku.get(firstToken) ?? bySlug.get(slug);
    if (direct) return { product: direct, problem: null };
    const named = byTitle.get(normTitle(v)) ?? [];
    if (named.length === 1) return { product: named[0], problem: null };
    if (named.length > 1) {
      return { product: null, problem: `${named.length} products are called "${raw}"; use the SKU (${named.map((p) => p.sku).join(" or ")})` };
    }
    return { product: null, problem: `Product "${raw}" not found` };
  };

  const cell = (r: string[], k: keyof typeof COLUMNS) => (idx[k] >= 0 ? (r[idx[k]] ?? "").trim() : "");
  const rows: ImportRow[] = table.slice(1).map((r, i) => {
    const productInput = cell(r, "product");
    const match = productInput ? find(productInput) : { product: null, problem: null };
    const product = match.product;
    const ratingRaw = cell(r, "rating");
    const rating = Math.round(Number((ratingRaw.match(/[\d.]+/) ?? [ratingRaw.split("★").length - 1])[0]));
    const authorName = cell(r, "name");
    const body = cell(r, "body");
    let error: string | null = null;
    if (productInput && !product) error = match.problem;
    else if (!authorName) error = "Name is empty";
    else if (!(rating >= 1 && rating <= 5)) error = `Rating "${ratingRaw}" must be 1 to 5`;
    else if (body.length < 2) error = "Review text is empty";
    const source = SOURCES[cell(r, "source").toLowerCase()] ?? "OTHER";
    return {
      line: i + 2,
      productInput,
      product: product ? { id: product.id, title: product.title, slug: product.slug } : null,
      authorName: authorName.slice(0, 100),
      authorCity: cell(r, "city").slice(0, 100) || null,
      rating,
      title: cell(r, "title").slice(0, 150) || null,
      body: body.slice(0, 5000),
      reviewedAt: parseDate(cell(r, "date")).toISOString(),
      source,
      verifiedPurchase: idx.verified >= 0 ? yes(cell(r, "verified")) : !!product,
      featured: idx.homepage >= 0 ? yes(cell(r, "homepage")) : false,
      error,
      duplicate: false,
    };
  });

  // Skip reviews that are already on the site (same product, name and text), e.g. a paste imported twice.
  const ok = rows.filter((r) => !r.error);
  if (ok.length) {
    const existing = await prisma.review.findMany({
      where: { authorName: { in: [...new Set(ok.map((r) => r.authorName))] } },
      select: { productId: true, authorName: true, body: true },
    });
    const key = (p: string | null, n: string, b: string) => `${p ?? ""}|${n.toLowerCase()}|${b.toLowerCase()}`;
    const seen = new Set(existing.map((e) => key(e.productId, e.authorName, e.body)));
    for (const r of ok) {
      const k = key(r.product?.id ?? null, r.authorName, r.body);
      if (seen.has(k)) r.duplicate = true;
      seen.add(k);
    }
  }
  return { rows, error: null };
}
