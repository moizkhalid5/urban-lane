/**
 * Canonical catalog source data: the full navigation/category tree and brand list.
 * Consumed by the seed script. Slugs are derived as path-prefixed, globally-unique
 * strings (e.g. "women-trousers-jeans") so repeated leaf names ("Other", "Tops")
 * never collide.
 */

export type CategoryNode = {
  name: string;
  children?: CategoryNode[];
  isVirtual?: boolean;
};

export type RootCategory = CategoryNode & {
  /** Gender / grouping tag propagated to descendant products. */
  gender: string;
};

export const CATEGORY_TREE: RootCategory[] = [
  {
    name: "Women",
    gender: "women",
    children: [
      { name: "Dresses", children: [{ name: "Maxi Dress" }, { name: "Midi Dress" }, { name: "Other" }] },
      { name: "Tops" },
      {
        name: "Trousers",
        children: [
          { name: "Jeans" },
          { name: "Chinos" },
          { name: "Leggings" },
          { name: "Jeggings" },
          { name: "Other" },
        ],
      },
      {
        name: "Lingerie",
        children: [
          {
            name: "Bras",
            children: [
              { name: "Non Wired" },
              { name: "Full Cup" },
              { name: "Cotton" },
              { name: "Multi Pack" },
              { name: "Sports Bra" },
              { name: "Bralettes" },
              { name: "Nursing" },
              { name: "Padded" },
              { name: "Other" },
            ],
          },
          {
            name: "Knickers",
            children: [
              { name: "Briefs" },
              { name: "Thongs" },
              { name: "High Leg" },
              { name: "High Waist" },
              { name: "Other" },
            ],
          },
        ],
      },
      { name: "Loungewear", children: [{ name: "Joggers" }, { name: "Pyjamas" }, { name: "Other" }] },
      {
        name: "Nightwear",
        children: [{ name: "Pyjama Sets" }, { name: "Slips" }, { name: "Night Dresses" }, { name: "Other" }],
      },
      { name: "Coats and Jackets" },
      { name: "Activewear", children: [{ name: "Tops" }, { name: "Bottoms" }, { name: "Other" }] },
      {
        name: "Accessories",
        children: [
          { name: "Bags and Purses" },
          { name: "Sunglasses" },
          { name: "Watches" },
          { name: "Caps, Hats and Scarves" },
          { name: "Other" },
        ],
      },
    ],
  },
  {
    name: "Men",
    gender: "men",
    children: [
      {
        name: "Tops",
        children: [
          { name: "Shirts", children: [{ name: "Formal" }, { name: "Casual" }] },
          { name: "T-Shirts" },
          { name: "Polo's" },
          { name: "Hoodies" },
        ],
      },
      {
        name: "Trousers",
        children: [
          { name: "Chinos" },
          { name: "Jeans" },
          { name: "Cargo" },
          { name: "Formal Pants" },
          { name: "Relaxed Fit" },
          { name: "Shorts" },
          { name: "Joggers" },
        ],
      },
      { name: "Coats and Jackets" },
      { name: "Underwear", children: [{ name: "Trunks" }, { name: "Briefs" }, { name: "Boxers" }] },
      { name: "Suits", children: [{ name: "Jackets" }, { name: "Trousers" }] },
      {
        name: "Accessories",
        children: [
          { name: "Socks" },
          { name: "Sunglasses" },
          { name: "Hats" },
          { name: "Wallets" },
          { name: "Cufflinks" },
          { name: "Other" },
        ],
      },
      { name: "Nightwear", children: [{ name: "Pyjama Sets" }, { name: "Tops" }, { name: "Shorts" }] },
    ],
  },
  {
    name: "Kids",
    gender: "kids",
    children: [
      {
        name: "Boys 2-8 YRS",
        children: [{ name: "Tops" }, { name: "Trousers & Shorts" }, { name: "Sets" }],
      },
      {
        name: "Girls 2-8 YRS",
        children: [{ name: "Tops" }, { name: "Trousers & Shorts" }, { name: "Sets" }],
      },
      { name: "Baby Girls 0-24M", children: [{ name: "Tops" }, { name: "Trousers & Shorts" }] },
      { name: "Baby Boys 0-24M", children: [{ name: "Tops" }, { name: "Trousers & Shorts" }] },
    ],
  },
  {
    name: "Beauty",
    gender: "beauty",
    children: [
      { name: "Makeup" },
      { name: "Gift Sets" },
      { name: "Men's Grooming" },
      { name: "Nails" },
      { name: "Lips" },
      { name: "Lashes" },
      { name: "Face" },
      { name: "Eyes" },
      { name: "Moisturisers" },
      { name: "Suncare" },
      { name: "Fragrances" },
    ],
  },
  {
    name: "Jewellery",
    gender: "jewellery",
    children: [{ name: "Necklaces" }, { name: "Earrings" }, { name: "Bracelets" }, { name: "Other" }],
  },
  {
    name: "Outlet",
    gender: "outlet",
    isVirtual: true,
  },
];

export const BRANDS: string[] = [
  "Next",
  "River Island",
  "M&S",
  "Hollister",
  "Hype",
  "Esprit",
  "Zara",
  "Debenhams",
  "H&M",
  "New Look",
  "GAP",
  "Tu Clothing",
  "Lee Cooper",
  "Ellos",
  "Burton",
  "Easy",
  "Ralph Lauren",
  "Lacoste",
  "Maybelline",
  "Max Factor",
  "L'Oreal",
  "Sleek",
  "Revlon",
  "Rimmel",
  "Bourjois",
  "Nasty Gal",
  "Essie",
  "NYX",
  "Urban Decay",
  "Miss Sporty",
  "Adidas",
  "MAC",
  "Crew Clothing",
];

/** Featured brands shown in the homepage brand slider / linked from the Brands menu. */
/** Homepage "Shop by brand" cards, in display order. Card images: public/images/brands/<slug>.jpg */
export const FEATURED_BRANDS = [
  "Next", "H&M", "Tu Clothing", "M&S", "Burton", "New Look", "River Island", "Debenhams", "ASOS",
  "Hollister", "Matalan", "Dorothy Perkins", "Esprit", "GAP", "Racing Green", "Nasty Gal", "Oysho", "Threadbare",
];

/** Currencies (issues doc: PKR, USD, GBP, EUR with flags). Rates are relative to base PKR. */
export const CURRENCIES = [
  { code: "PKR", symbol: "Rs", flag: "🇵🇰", rate: 1, isBase: true, position: 0 },
  { code: "USD", symbol: "$", flag: "🇺🇸", rate: 0.0036, isBase: false, position: 1 },
  { code: "GBP", symbol: "£", flag: "🇬🇧", rate: 0.0028, isBase: false, position: 2 },
  { code: "EUR", symbol: "€", flag: "🇪🇺", rate: 0.0033, isBase: false, position: 3 },
];
