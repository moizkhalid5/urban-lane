/**
 * Shared wording helpers for search titles, descriptions and structured data: which department a product
 * belongs to, a category's full human name ("Baby Girls' Tops" rather than "Tops"), and clean plain text
 * from descriptions copied from brand sites.
 */

export type Department = "women" | "men" | "kids" | "beauty" | "jewellery";
const DEPARTMENTS: Department[] = ["women", "men", "kids", "beauty", "jewellery"];

/** Department from Product.gender ("Women", any case) or, failing that, the category slugs (beauty has no gender). */
export function departmentOf(gender: string | null | undefined, categorySlugs: string[]): Department | null {
  const g = gender?.trim().toLowerCase();
  if (g && (DEPARTMENTS as string[]).includes(g)) return g as Department;
  const roots = [...new Set(categorySlugs.map((s) => s.split("-")[0]).filter((r): r is Department => (DEPARTMENTS as string[]).includes(r)))];
  if (roots.length === 1) return roots[0];
  return roots.includes("beauty") ? "beauty" : null;
}

/** Description text without the "Product Details" heading copied from brand sites, with tidy whitespace. */
export function plainText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*product details\s*:?\s*/i, "")
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** One line of prose from description text: sentences kept, bullet lines joined with commas. */
export function prose(s: string | null | undefined): string {
  return plainText(s)
    .split("\n")
    .map((l) => l.replace(/^[•\-–*]\s*/, ""))
    .reduce((out, l) => (out ? `${out}${/[.!?:]$/.test(out) ? " " : ", "}${l}` : l), "");
}

/** Cut at a word boundary to at most `max` characters, with an ellipsis only when something was cut. */
export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).replace(/[\s,;:–-]+$/, "")}…`;
}

const POSSESSIVE: Record<string, string> = {
  women: "Women's",
  men: "Men's",
  kids: "Kids'",
  "boys 2-8 yrs": "Boys'",
  "girls 2-8 yrs": "Girls'",
  "baby girls 0-24m": "Baby Girls'",
  "baby boys 0-24m": "Baby Boys'",
};
const AGE_NOTE: Record<string, string> = {
  "boys 2-8 yrs": "(2–8 Years)",
  "girls 2-8 yrs": "(2–8 Years)",
  "baby girls 0-24m": "(0–24 Months)",
  "baby boys 0-24m": "(0–24 Months)",
};

/**
 * A category's full name for titles and headings, from its path: ["Women","Dresses"] → "Women's Dresses",
 * ["Kids","Baby Girls 0-24M","Tops"] → "Baby Girls' Tops (0–24 Months)", ["Men","Tops","Shirts","Formal"]
 * → "Men's Formal Shirts", ["Beauty","Lips"] → "Lip Makeup".
 */
export function categoryLabel(path: string[]): string {
  const names = path.map((n) => n.trim());
  if (!names.length) return "";
  const [root, ...rest] = names;
  const rootKey = root.toLowerCase();
  if (rootKey === "beauty") return rest.length ? beautyLabel(rest[rest.length - 1]) : "Beauty & Makeup";
  if (rootKey === "jewellery") return rest.length && rest[rest.length - 1].toLowerCase() !== "other" ? rest[rest.length - 1] : "Jewellery";
  if (!rest.length) return rootKey === "kids" ? "Kids' Clothing" : POSSESSIVE[rootKey] ? `${POSSESSIVE[rootKey]} Clothing` : root;

  // Kids: the age group gives the possessive and the age note.
  let owner = POSSESSIVE[rootKey] ?? root;
  let note = "";
  let parts = rest;
  const group = rest[0].toLowerCase();
  if (POSSESSIVE[group]) {
    owner = POSSESSIVE[group];
    note = AGE_NOTE[group] ?? "";
    parts = rest.slice(1);
    if (!parts.length) return `${owner} Clothing ${note}`.trim();
  }
  // The leaf, qualified by its parent where the leaf alone is vague ("Formal" → "Formal Shirts").
  const leaf = parts[parts.length - 1];
  const parent = parts.length > 1 ? parts[parts.length - 2] : "";
  const p = parent.toLowerCase();
  const l = leaf.toLowerCase();
  let thing = leaf;
  if (l === "other" && parent) thing = `Other ${parent}`;
  else if (p === "activewear" || (p === "nightwear" && /^(tops|shorts)$/.test(l))) thing = `${parent} ${leaf}`;
  else if (p === "suits" && /^(jackets|trousers)$/.test(l)) thing = `Suit ${leaf}`;
  else if (p === "bras" && !/bra/.test(l)) thing = `${leaf} Bras`;
  else if (p === "knickers" && /^(high leg|high waist)$/.test(l)) thing = `${leaf} Knickers`;
  else if (p === "shirts" && /^(formal|casual)$/.test(l)) thing = `${leaf} Shirts`;
  else if (p === "dresses" && /dress$/.test(l)) thing = `${leaf}es`;
  else if (p === "trousers" && /^(cargo|relaxed fit)$/.test(l)) thing = `${leaf} Trousers`;
  thing = thing
    .replace(/^Polo's$/i, "Polo Shirts")
    .replace(/^Sports Bra$/i, "Sports Bras")
    .replace(/ and /g, " & ");
  return `${owner} ${thing} ${note}`.replace(/\s+/g, " ").trim();
}

function beautyLabel(leaf: string): string {
  const map: Record<string, string> = {
    lips: "Lip Makeup",
    eyes: "Eye Makeup",
    face: "Face Makeup",
    nails: "Nail Polish",
    lashes: "False Lashes & Mascara",
    makeup: "Makeup",
    "gift sets": "Beauty Gift Sets",
    "men's grooming": "Men's Grooming",
    moisturisers: "Moisturisers",
    suncare: "Suncare",
    fragrances: "Fragrances",
  };
  return map[leaf.toLowerCase()] ?? leaf;
}
