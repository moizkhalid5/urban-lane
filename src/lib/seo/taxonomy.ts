/**
 * The shop's categories mapped to Google's product taxonomy (ids from
 * https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt, version 2021-09-21), for the
 * Merchant Center feed. Matched on the product's most specific category slug (path-based, e.g.
 * "kids-baby-girls-0-24m-tops"); the first rule that matches wins, so specific rules come first.
 */
const RULES: [RegExp, number][] = [
  [/lingerie-bras|(^|-)bras(-|$)/, 214], // Underwear & Socks > Bras
  [/knickers|underwear-(briefs|boxers|trunks)|(^|-)(briefs|boxers|trunks)(-|$)/, 2562], // > Underwear
  [/socks/, 209], // > Socks
  [/nightwear|loungewear|pyjama|slips/, 208], // Sleepwear & Loungewear
  [/activewear/, 5322], // Activewear
  [/kids-baby-.*-(tops)/, 5410], // Baby & Toddler Tops
  [/kids-baby-.*-(trousers|shorts)/, 5408], // Baby & Toddler Bottoms
  [/kids-baby-.*-sets|kids-baby/, 5622], // Baby & Toddler Outfits
  [/(^|-)sets(-|$)/, 7313], // Outfit Sets
  [/dresses|dress(-|$)/, 2271], // Dresses
  [/coats-and-jackets|suits-jackets/, 5598], // Outerwear > Coats & Jackets
  [/suits/, 1594], // Suits
  [/(^|-)shorts(-|$)/, 207], // Shorts
  [/trousers|jeans|chinos|joggers|cargo|leggings|jeggings|formal-pants|relaxed-fit/, 204], // Pants
  [/tops|shirts|polos|hoodies|t-shirts/, 212], // Shirts & Tops
  [/sunglasses/, 178],
  [/hats|caps/, 173],
  [/wallets/, 2668],
  [/bags-and-purses|bags/, 3032],
  [/^jewellery/, 188],
  [/^beauty-lips/, 2645], // Makeup > Lip Makeup
  [/^beauty-lashes/, 2761], // Eye Makeup > False Eyelashes
  [/^beauty-eyes/, 2779], // Eye Makeup
  [/^beauty-face/, 2571], // Face Makeup
  [/^beauty-nails/, 2683], // Nail Polishes
  [/^beauty-fragrances/, 479], // Perfume & Cologne
  [/^beauty-(moisturisers|suncare)/, 567], // Skin Care
  [/^beauty/, 477], // Makeup
];

/** Google product category id for a product, from its category slugs (most specific first). */
export function googleCategoryId(slugs: string[]): number {
  for (const slug of slugs) for (const [re, id] of RULES) if (re.test(slug)) return id;
  return 1604; // Apparel & Accessories > Clothing
}
