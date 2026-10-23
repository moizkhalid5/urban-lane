import type { DisplayCurrency } from "@/lib/money";
import type { ProductFilter, ProductSort } from "@/lib/queries/products";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined) => {
  const s = one(v);
  return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined;
};

const VALID_SORTS: ProductSort[] = ["latest", "price-asc", "price-desc", "featured", "best-selling"];

/** ?gender=men|women narrows a collection to one department (e.g. the men's banner → Winter, men only). */
const GENDERS: Record<string, string> = { men: "Men", women: "Women" };

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
    gender: GENDERS[(one(sp.gender) ?? "").toLowerCase()],
    page,
  };
}

/** Convert base-currency minor units to a display-currency whole-number amount. */
export function baseToDisplay(baseMinor: number, currency: DisplayCurrency): number {
  return Math.round((baseMinor / 100) * currency.rate);
}
