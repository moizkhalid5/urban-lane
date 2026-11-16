import type { Metadata } from "next";
import { APP_URL } from "@/lib/site";
import { categoryLabel, clip, type Department } from "@/lib/seo/copy";
import type { ListingStats } from "@/lib/seo/stats";

/**
 * Search titles and descriptions, written the way shoppers in Pakistan search (researched Nov 2026 from
 * Google's Pakistan autocomplete and the stores that rank):
 * - "price in Pakistan" is the strongest modifier (products, beauty, jeans, hoodies…);
 * - "imported" / "original" for clothing and makeup; brand + "Pakistan" for the big names;
 * - cash on delivery, Easypaisa/JazzCash and free delivery belong in the description, not the title.
 * Titles aim for ≤ 65 characters (what Google shows); each builder tries the strongest wording first and
 * falls back to shorter ones. A title or description entered in the admin always wins.
 */

const SITE = "Urban Lane";
const SUFFIX = ` | ${SITE}`;
const TITLE_MAX = 65;
const DESC_MAX = 160;

export type ShopFacts = { freeShippingThresholdCents: number | null };

export const rupees = (cents: number) => `Rs ${Math.round(cents / 100).toLocaleString("en-GB")}`;

/**
 * The strongest candidate that fits: with " | Urban Lane" if there's room, else without it (Google shows
 * the site name beside the result anyway, so the keyword matters more than our name). Else the shortest.
 */
function fitTitle(candidates: string[]): Metadata["title"] {
  const list = candidates.map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean);
  for (const c of list) {
    if (c.length + SUFFIX.length <= TITLE_MAX) return c; // the layout's template adds " | Urban Lane"
    if (c.length <= TITLE_MAX) return { absolute: c };
  }
  return { absolute: list.reduce((a, b) => (b.length < a.length ? b : a)) };
}

type Part = string | string[] | null | false | undefined;

/**
 * Sentences added in order of importance while they fit in 160 characters; a part given as a list tries
 * its wordings longest-first. The first part always stays (clipped if it must).
 */
function fitDescription(parts: Part[]): string {
  const list = parts.filter((p): p is string | string[] => !!p && (!Array.isArray(p) || p.length > 0));
  const first = Array.isArray(list[0]) ? list[0][0] : (list[0] ?? "");
  let out = clip(first.trim(), DESC_MAX);
  for (const p of list.slice(1)) {
    const options = (Array.isArray(p) ? p : [p]).map((o) => o.trim());
    const fit = options.find((o) => `${out} ${o}`.length <= DESC_MAX);
    if (fit) out = `${out} ${fit}`;
  }
  return out;
}

/** Payment and delivery, most complete wording first. */
const serviceLine = (shop: ShopFacts) => [
  ...(shop.freeShippingThresholdCents != null ? [`Cash on delivery, Easypaisa/JazzCash, free delivery over ${rupees(shop.freeShippingThresholdCents)}.`] : []),
  "Cash on delivery, Easypaisa and JazzCash.",
  "Cash on delivery.",
];

/** "Shop 22 imported…" only when the number impresses; "Shop imported…" otherwise. */
const howMany = (n: number) => (n >= 5 ? `${n} ` : "");

/** "Next, H&M and M&S" */
const andList = (names: string[]) => (names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/* ---------- product ---------- */

type MetaProduct = {
  title: string;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  priceCents: number;
  compareAtCents: number | null;
  brand: { name: string } | null;
  images: { url: string }[];
  variants: { size: string | null; stock: number }[];
};

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);
const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.replace(/(^|[-/(])([a-z])/g, (_, pre: string, c: string) => pre + c.toUpperCase())))
    .join(" ");
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The product name as people search it, tidied for search results only (the page keeps the catalogue's
 * name): the brand once and in front, in its proper spelling ("RiverIsland Green…" under River Island →
 * "River Island Green…"), and shouting capitals calmed ("CURVED HEM T-SHIRT 3-PACK" → "Curved Hem T-Shirt 3-Pack").
 */
export function brandedTitle(p: { title: string; brand: { name: string } | null }): string {
  let words = p.title.replace(/\s+/g, " ").trim().split(" ");
  const brand = p.brand?.name.trim();
  if (brand) {
    const b = squash(brand);
    // drop the brand however it's written at the start ("NASTY GAL", "RiverIsland", "River Island")
    for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
      if (squash(words.slice(0, n).join("")) === b) {
        words = words.slice(n);
        break;
      }
    }
    // and a second copy straight after it ("River Island RiverIsland …")
    if (words.length > 1 && squash(words[0]) === b) words = words.slice(1);
  }
  let rest = words.join(" ");
  const letters = rest.replace(/[^A-Za-z]/g, "");
  if (letters.length > 6 && (letters === letters.toUpperCase() || letters === letters.toLowerCase())) rest = titleCase(rest);
  return brand ? `${brand} ${rest}` : rest;
}

export function productMetadata(p: MetaProduct, shop: ShopFacts): Metadata {
  const name = brandedTitle(p);
  const onSale = !!p.compareAtCents && p.compareAtCents > p.priceCents;
  const pct = onSale ? Math.round(((p.compareAtCents! - p.priceCents) / p.compareAtCents!) * 100) : 0;
  const sizes = [...new Set(p.variants.filter((v) => v.stock > 0 && v.size?.trim()).map((v) => v.size!.trim()))];
  const sizeLine = !sizes.length
    ? null
    : sizes.length === 1
      ? `Size ${sizes[0]}.`
      : `Sizes ${sizes.length > 5 ? `${sizes.slice(0, 4).join(", ")} and more` : sizes.join(", ")}.`;

  const title = p.seoTitle?.trim() ? { absolute: p.seoTitle.trim() } : fitTitle([`${name} Price in Pakistan`, name]);
  const description =
    p.seoDescription?.trim() ||
    fitDescription([
      `Buy original ${name} in Pakistan for ${rupees(p.priceCents)}${onSale ? ` (was ${rupees(p.compareAtCents!)}, ${pct}% off)` : ""}.`,
      sizeLine,
      serviceLine(shop),
      "14-day returns.",
    ]);
  const image = p.images[0]?.url;
  return {
    title,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: {
      title: `${name} – ${rupees(p.priceCents)}`,
      description,
      url: `/products/${p.slug}`,
      images: image ? [/^https?:/.test(image) ? image : `${APP_URL}${encodeURI(image)}`] : undefined,
      type: "website",
    },
  };
}

/* ---------- category ---------- */

const QUALIFIER: Record<Department, string> = { women: "Imported", men: "Imported", kids: "Imported", beauty: "Original", jewellery: "" };

/**
 * A category page: "Imported Women's Dresses in Pakistan | Next, H&M", "Original Lip Makeup in Pakistan |
 * Maybelline, NYX", "Imported Baby Girls' Tops in Pakistan".
 */
export function categoryMetadata(
  c: { name: string; slug: string; seoTitle: string | null; seoDescription: string | null },
  path: string[],
  stats: ListingStats,
  shop: ShopFacts,
  indexable: boolean,
): Metadata {
  const root = (path[0] ?? c.name).toLowerCase() as Department;
  const q = QUALIFIER[root] ?? "";
  const label = categoryLabel(path);
  const short = label.replace(/\s*\(.*\)$/, ""); // without "(0–24 Months)"
  const brands = stats.brands.map((b) => b.name);
  const isRoot = path.length <= 1;
  const head = root === "beauty" && isRoot ? "Original Makeup & Beauty" : `${q} ${label}`;
  const headShort = root === "beauty" && isRoot ? "Original Makeup" : `${q} ${short}`;

  const title = c.seoTitle?.trim()
    ? { absolute: c.seoTitle.trim() }
    : fitTitle([
        brands.length >= 2 && `${head} in Pakistan | ${brands[0]}, ${brands[1]}`,
        brands.length >= 1 && `${head} in Pakistan | ${brands[0]}`,
        `${head} in Pakistan`,
        brands.length >= 1 && `${headShort} in Pakistan | ${brands[0]}`,
        `${headShort} in Pakistan`,
        short,
      ].filter((t): t is string => !!t));

  const what = root === "beauty" && isRoot ? "makeup and beauty products" : label.toLowerCase();
  const description =
    c.seoDescription?.trim() ||
    fitDescription([
      stats.count
        ? `Shop ${howMany(stats.count)}${q ? `${q.toLowerCase()} ` : ""}${what} in Pakistan${brands.length ? ` from ${andList(brands.slice(0, 3))}` : ""}${stats.minCents != null ? `, from ${rupees(stats.minCents)}` : ""}.`
        : `${label} from UK high-street brands, delivered across Pakistan.`,
      serviceLine(shop),
      stats.onSale > 0 && stats.maxDiscountPct >= 10 ? `Up to ${stats.maxDiscountPct}% off selected styles.` : null,
    ]);

  return {
    title,
    description,
    alternates: { canonical: `/collections/${c.slug}` },
    openGraph: { title: typeof title === "string" ? title : (title as { absolute: string }).absolute, description, url: `/collections/${c.slug}` },
    ...(!indexable && { robots: { index: false, follow: true } }),
  };
}

/* ---------- brand ---------- */

const DEPT_WORD: Record<Department, string> = { women: "Women", men: "Men", kids: "Kids", beauty: "Beauty", jewellery: "Jewellery" };
/** A brand that only dresses one department: "Original H&M Kids Clothes in Pakistan". */
const ONE_DEPT: Record<string, string> = { Women: "Women's Clothes", Men: "Men's Clothes", Kids: "Kids Clothes" };

/** A brand page: "Original Maybelline Makeup Price in Pakistan", "Original Next Clothes in Pakistan | Kids, Women, Men". */
export function brandMetadata(
  b: { name: string; slug: string; seoTitle: string | null; seoDescription: string | null },
  stats: ListingStats,
  shop: ShopFacts,
): Metadata {
  const beauty = stats.departments[0] === "beauty";
  const depts = stats.departments.filter((d) => d !== "beauty" && d !== "jewellery").map((d) => DEPT_WORD[d]);
  // "Tu Clothing", not "Tu Clothing Clothes"
  const clothes = /clothing$/i.test(b.name) ? b.name : `${b.name} Clothes`;
  const title = b.seoTitle?.trim()
    ? { absolute: b.seoTitle.trim() }
    : fitTitle(
        beauty
          ? [`Original ${b.name} Makeup Price in Pakistan`, `Original ${b.name} Makeup in Pakistan`, `${b.name} Pakistan`]
          : [
              depts.length > 1 && `Original ${clothes} in Pakistan | ${depts.slice(0, 3).join(", ")}`,
              depts.length === 1 && `Original ${b.name} ${ONE_DEPT[depts[0]]} in Pakistan`,
              `Original ${clothes} in Pakistan`,
              `${b.name} Pakistan`,
            ].filter((t): t is string => !!t),
      );
  const range = depts.length ? `for ${andList(depts.map((d) => d.toLowerCase()))}` : "";
  const description =
    b.seoDescription?.trim() ||
    fitDescription([
      stats.count
        ? `Shop ${howMany(stats.count)}original ${b.name} ${beauty ? "makeup and beauty products" : `pieces ${range}`.trim()} in Pakistan${stats.minCents != null ? `, from ${rupees(stats.minCents)}` : ""}.`
        : `Original ${b.name} at Urban Lane, delivered across Pakistan.`,
      serviceLine(shop),
      stats.onSale > 0 && stats.maxDiscountPct >= 10 ? `Up to ${stats.maxDiscountPct}% off selected styles.` : null,
    ]);
  return {
    title,
    description,
    alternates: { canonical: `/brands/${b.slug}` },
    openGraph: { title: typeof title === "string" ? title : (title as { absolute: string }).absolute, description, url: `/brands/${b.slug}` },
    ...(stats.count === 0 && { robots: { index: false, follow: true } }),
  };
}

/* ---------- home ---------- */

export function homeMetadata(shop: ShopFacts, topBrands: string[]): Metadata {
  const description = fitDescription([
    `Original UK high-street brands in Pakistan: ${topBrands.slice(0, 4).join(", ")} and more, for women, men, kids and beauty.`,
    serviceLine(shop),
  ]);
  return {
    title: { absolute: `Original UK Brands Online in Pakistan${SUFFIX}` },
    description,
    alternates: { canonical: "/" },
    openGraph: { title: `${SITE}: Original UK Brands in Pakistan`, description, url: "/" },
  };
}
