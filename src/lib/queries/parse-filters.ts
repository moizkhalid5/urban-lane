import type { DisplayCurrency } from "@/lib/money";
import type { ProductFilter, ProductSort } from "@/lib/queries/products";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined) => {
  const s = one(v);
  return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined;
};

const VALID_SORTS: ProductSort[] = ["latest", "price-asc", "price-desc", "featured", "best-selling"];

/**
 * ?gender=men|women|kids narrows a listing to one department (e.g. the men's banner → Winter, men only);
 * a list (?gender=men,women,kids) to several.
 */
const GENDERS: Record<string, string> = { men: "Men", women: "Women", kids: "Kids" };

/** ?save=1 → any discount shown; ?save=25-35 → discounts from 25% to 35%. */
function parseSave(raw: string | undefined): { min: number; max: number } | undefined {
  const m = raw?.match(/^(\d{1,2})(?:-(\d{1,3}))?$/);
  if (!m) return undefined;
  const min = Math.max(1, Number(m[1]));
  const max = m[2] ? Number(m[2]) : 100;
  return max >= min ? { min, max } : undefined;
}

/** Convert a display-currency major amount into base-currency minor units. */
function toBaseMinor(displayMajor: number, currency: DisplayCurrency): number {
  return Math.round((displayMajor / currency.rate) * 100);
}

/** Parse storefront listing query params into a normalized ProductFilter. */
export function parseFilters(sp: RawSearchParams, currency: DisplayCurrency): ProductFilter {
  const sortRaw = one(sp.sort) as ProductSort | undefined;
  const minRaw = one(sp.min);
  const maxRaw = one(sp.max);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const genders = [...new Set((list(sp.gender) ?? []).map((g) => GENDERS[g.toLowerCase()]).filter(Boolean))];

  return {
    brandSlugs: list(sp.brands),
    sizes: list(sp.sizes),
    ages: list(sp.ages),
    colors: list(sp.colors),
    minCents: minRaw ? toBaseMinor(Number(minRaw), currency) : undefined,
    maxCents: maxRaw ? toBaseMinor(Number(maxRaw), currency) : undefined,
    inStockOnly: one(sp.inStock) === "1",
    saleOnly: one(sp.sale) === "1",
    sort: sortRaw && VALID_SORTS.includes(sortRaw) ? sortRaw : "latest",
    q: one(sp.q),
    gender: genders.length === 1 ? genders[0] : undefined,
    genders: genders.length > 1 ? genders : undefined,
    save: parseSave(one(sp.save)),
    page,
  };
}

/** Chip label for a ?save= view: "On offer" or "Save 25–35%". */
export function saveLabel(save: { min: number; max: number }): string {
  if (save.max >= 100) return save.min <= 1 ? "On offer" : `Save ${save.min}%+`;
  return `Save ${save.min}–${save.max}%`;
}

/** Possessive department name for headings: "Men's", "Women's", "Kids'". */
export const DEPARTMENT_POSSESSIVE: Record<string, string> = { Men: "Men's", Women: "Women's", Kids: "Kids'" };

/** Convert base-currency minor units to a display-currency whole-number amount. */
export function baseToDisplay(baseMinor: number, currency: DisplayCurrency): number {
  return Math.round((baseMinor / 100) * currency.rate);
}
