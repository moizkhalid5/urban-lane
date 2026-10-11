/**
 * Sorts a product into sub-categories from its title (and sizes, for kids/suits).
 * Imports only know the department (women/men/kids/beauty); these rules place each
 * product under the deeper categories shown in the navigation. Used by
 * prisma/backfill-subcategories.ts and prisma/import-additions.ts. Keep dependency-free.
 *
 * Returns category slugs (see prisma/data/catalog-data.ts). Linking a product to a
 * category also lists it on every ancestor page, so the deepest known level is enough.
 * An empty array means "department only" (no confident match).
 */
import { sizeAgeMonths } from "./kids-age";

type Rule = [RegExp, string | ((t: string, sizes: string[]) => string | null)];

const first = (t: string, sizes: string[], rules: Rule[]): string | null => {
  for (const [re, to] of rules) {
    if (re.test(t)) return typeof to === "string" ? to : to(t, sizes);
  }
  return null;
};

// Tailoring sizes such as "40 R", "42S", "34 L" (chest/waist + fit) mark suit pieces.
const tailored = (sizes: string[]) => sizes.some((s) => /^\d{2}\s?[RSL]$/i.test(s.trim()));

const WOMEN: Rule[] = [
  [/\bbra\b|bralette/, (t) =>
    /sports bra/.test(t) ? "women-lingerie-bras-sports-bra"
    : /bralette/.test(t) ? "women-lingerie-bras-bralettes"
    : /\bpadded|padding|moulded/.test(t) && !/non-padded/.test(t) ? "women-lingerie-bras-padded"
    : /non-wired|wire free|wireless/.test(t) ? "women-lingerie-bras-non-wired"
    : /full cup/.test(t) ? "women-lingerie-bras-full-cup"
    : "women-lingerie-bras-other"],
  [/knicker|\bbriefs?\b|\bbrf\b|\bfb\b|bikini|high ?leg|thong|^(debenhams )?5pp\b|pack of 5 .*shorts/, (t) =>
    /high ?leg/.test(t) ? "women-lingerie-knickers-high-leg"
    : /thong/.test(t) ? "women-lingerie-knickers-thongs"
    : /\bbriefs?\b|\bbrf\b|\bfb\b|bikini/.test(t) ? "women-lingerie-knickers-briefs"
    : "women-lingerie-knickers-other"],
  [/chemise|\bslip\b/, "women-nightwear-slips"],
  [/pyjama bottoms/, "women-loungewear-pyjamas"],
  [/pyjama|pajama|\bpj\b|nightwear/, "women-nightwear-pyjama-sets"],
  [/dress/, "women-dresses"],
  [/jegging/, "women-trousers-jeggings"],
  [/legging/, "women-trousers-leggings"],
  [/jeans?\b|denim/, "women-trousers-jeans"],
  [/chino/, "women-trousers-chinos"],
  [/trouser|utility/, "women-trousers-other"],
  [/\bcoat\b|jacket/, "women-coats-and-jackets"],
  [/sunglasses/, "women-accessories-sunglasses"],
  [/\bgrab\b|\bbag\b|purse/, "women-accessories-bags-and-purses"],
  [/active|impact/, "women-activewear-tops"],
  [/\btops?\b|t-shirt|peplum|blouse/, "women-tops"],
];

const MEN: Rule[] = [
  [/tuxedo trousers|suit trousers/, "men-suits-trousers"],
  [/jacket|\bcoat\b|fleece quilt/, (t, s) => (tailored(s) && !/harrington|padded|denim|nylon/.test(t) ? "men-suits-jackets" : "men-coats-and-jackets")],
  [/pyjama|pajama|lounge set|short set|bottoms sets?/, "men-nightwear-pyjama-sets"],
  [/boxer/, "men-underwear-boxers"],
  [/trunks/, "men-underwear-trunks"],
  [/briefs|underwear/, "men-underwear-briefs"],
  [/sunglasses|glasses/, "men-accessories-sunglasses"],
  [/\bcap\b|\bhat\b/, "men-accessories-hats"],
  [/wallet|cardholder/, "men-accessories-wallets"],
  [/face covering/, "men-accessories-other"],
  [/hoodie|jumper/, "men-tops-hoodies"],
  [/polo/, "men-tops-polos"],
  [/\bt[- ]?shirts?\b|\btee\b|crew neck short sleeve shirt-set|burton smart/, "men-tops-t-shirts"], // Burton "Smart … Blocking" are tees
  [/shirt/, (t, s) =>
    /formal|single cuff/.test(t) || s.some((x) => /^\d{2}(\.5)?\s?R?$/i.test(x.trim()))
      ? "men-tops-shirts-formal"
      : "men-tops-shirts-casual"],
  [/shorts/, "men-trousers-shorts"],
  [/jogger/, "men-trousers-joggers"],
  [/cargo/, "men-trousers-cargo"],
  [/jeans?\b|denim|tint stretch slim fit/, "men-trousers-jeans"],
  [/chino/, "men-trousers-chinos"],
  [/trouser/, (t) => (/check|tailored|formal|suit/.test(t) ? "men-trousers-formal-pants" : "men-trousers-relaxed-fit")],
];

const BEAUTY: Rule[] = [
  [/nail/, "beauty-nails"],
  [/mascara/, (t) => (/brow/.test(t) ? "beauty-eyes" : "beauty-lashes")],
  [/\blip|lipstick|matte ink|outlast|color riche|infallible \d/, "beauty-lips"],
  [/eye|kohl|kajal|brow|eyeliner|city kits|city mini|palette infaillible/, "beauty-eyes"],
  [/foundation|bb cream|conceal|powder|contour|highlighter|blush|cheek|strobing|makeup stick/, "beauty-face"],
];

/** Baby (0-24 months) vs 2-8 years, from the size labels. A product can be in both. */
function kidsAges(sizes: string[]): { baby: boolean; older: boolean } {
  let baby = false;
  let older = false;
  for (const size of sizes) {
    const r = sizeAgeMonths(size);
    if (!r) continue;
    if (r[0] < 24) baby = true;
    if (r[1] > 24) older = true;
  }
  if (!baby && !older) older = true;
  return { baby, older };
}

function kids(t: string, sizes: string[]): string[] {
  const girl = /girl|dress|blouse|legging|unicorn|floral|pink|minnie|rose|swan/.test(t);
  const boy = /\bboy|digger|dino|shark|dragon|axolotl/.test(t);
  const genders = girl && !boy ? ["girls"] : boy && !girl ? ["boys"] : ["girls", "boys"];
  const isSet = /\bsets?\b|piece|top & |tees\/shorts|with shorts|shirt with|& short|dungarees|crew neck multi colour/.test(t);
  const isBottom = /shorts|legging|trouser|pants/.test(t);
  const isDress = /dress/.test(t);
  const { baby, older } = kidsAges(sizes);

  const out: string[] = [];
  for (const g of genders) {
    if (older) {
      const base = `kids-${g}-2-8-yrs`;
      out.push(isDress ? base : isSet ? `${base}-sets` : isBottom ? `${base}-trousers-and-shorts` : `${base}-tops`);
    }
    if (baby) {
      const base = `kids-baby-${g}-0-24m`;
      // Baby ranges have no "Sets" page: a set is both a top and a bottom.
      if (isDress) out.push(base);
      else if (isSet) out.push(`${base}-tops`, `${base}-trousers-and-shorts`);
      else out.push(isBottom ? `${base}-trousers-and-shorts` : `${base}-tops`);
    }
  }
  return out;
}

/**
 * @param department top-level slug the product already belongs to ("women", "men", "kids", "beauty")
 */
export function subcategoriesFor(title: string, department: string, sizes: string[] = []): string[] {
  const t = title.toLowerCase().replace(/\s+/g, " ");
  if (department === "kids") return kids(t, sizes);
  const rules = department === "women" ? WOMEN : department === "men" ? MEN : department === "beauty" ? BEAUTY : null;
  const hit = rules ? first(t, sizes, rules) : null;
  return hit ? [hit] : [];
}
