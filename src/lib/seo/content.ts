/**
 * Hand-written buying guides for the listing pages that matter most (departments, the biggest categories
 * and brands), shown under the products: what's there, how sizes work, what each brand is like. Written for
 * shoppers first; they also give Google real text to understand and rank the page (most competing shops
 * show a bare grid). Facts only: no sourcing or authenticity claims beyond what the shop states, policies as
 * on the Shipping and Returns pages.
 *
 * Tokens, filled from the live catalogue and settings when shown:
 *   {count} products on the page · {from} lowest price · {brands} top three brands · {freeOver} free-delivery
 *   threshold · {flat} delivery charge below it
 *
 * Page-specific FAQs come first; the shop-wide ones (originality, payment, delivery, returns) are added
 * after them by the component (components/seo/ListingGuide.tsx).
 */

export type Guide = {
  /** One or two sentences under the heading, above the products (unless the admin wrote a description). */
  intro?: string;
  /** Headed paragraphs under the products. */
  sections: { heading: string; paragraphs: string[] }[];
  faqs?: { q: string; a: string }[];
};

const WOMENS_SIZES =
  "Women's clothes come in UK sizes. UK 8 is EU 36 and US 4; UK 10 is EU 38 and US 6; UK 12 is EU 40 and US 8; UK 14 is EU 42 and US 10; UK 16 is EU 44 and US 12. Each product page shows exactly which sizes are left.";
const MENS_SIZES =
  "Men's tops use chest sizes (S, M, L, XL) or the chest in inches. Trousers and jeans are sized by the waist in inches plus a leg length: 32R is a 32-inch waist with a regular leg, S is short and L is long. If you're between two waist sizes, the larger one is usually the safer choice.";
const KIDS_SIZES =
  "Kids' clothes are sized by age (for example 12–18 months or 4–5 years); some brands such as H&M show both the age and the child's height. Children grow quickly, so if your child is near the top of an age range, take the next size up.";

export const CATEGORY_GUIDES: Record<string, Guide> = {
  women: {
    intro: "{count} pieces from {brands} and more, from {from}. Cash on delivery across Pakistan.",
    sections: [
      {
        heading: "Original UK high-street fashion for women in Pakistan",
        paragraphs: [
          "Urban Lane brings the women's labels you see on UK high streets to Pakistan: dresses, tops, trousers and jeans, coats, lingerie, nightwear and accessories from {brands} and more. Prices are in rupees, with cash on delivery anywhere in Pakistan.",
          "New pieces arrive in small quantities, so many styles have only one or two sizes left. If you see your size, it's worth ordering rather than waiting.",
        ],
      },
      { heading: "Women's size guide (UK to EU and US)", paragraphs: [WOMENS_SIZES] },
    ],
  },
  men: {
    intro: "{count} pieces from {brands} and more, from {from}. Cash on delivery across Pakistan.",
    sections: [
      {
        heading: "Original UK menswear in Pakistan",
        paragraphs: [
          "Shirts, T-shirts, chinos, jeans, suits, jackets and underwear from UK high-street brands such as {brands}. These are the same cuts sold in UK stores: slim and regular fits for shirts and trousers, and tailoring sold as jackets and trousers.",
          "Formal shirts and suits are a good place to start if you want UK tailoring for office or wedding season; casual shirts, T-shirts and chinos cover everyday wear.",
        ],
      },
      { heading: "Men's size guide", paragraphs: [MENS_SIZES] },
    ],
  },
  kids: {
    intro: "{count} pieces for babies and children from {brands} and more, from {from}.",
    sections: [
      {
        heading: "Imported kids' and baby clothes in Pakistan",
        paragraphs: [
          "Soft cotton bodysuits, T-shirts, sets, leggings and shorts from Next, H&M, Tu Clothing, M&S and other UK high-street brands, for babies (0–24 months) and children (2–8 years). Many come in multipacks, which is where UK brands are best value: three or five pieces for the price of one or two.",
          "Look at the product photos for prints and colours, and the details for fabric: many baby and kids' basics are 100% cotton, which is comfortable in Pakistan's heat.",
        ],
      },
      { heading: "Kids' size guide", paragraphs: [KIDS_SIZES] },
    ],
    faqs: [
      {
        q: "Which size should I buy for my child?",
        a: "Go by age, and if your child is tall for their age or near the end of the range, choose the next size up.",
      },
    ],
  },
  "kids-baby-girls-0-24m": {
    intro: "Bodysuits, tops, leggings and sets for baby girls from {brands}, from {from}.",
    sections: [
      {
        heading: "Baby girls' clothes (0–24 months)",
        paragraphs: [
          "Everyday cotton for baby girls: bodysuits and tops in multipacks, leggings, shorts and matching sets from Next, H&M, Tu Clothing and M&S. Poppers at the shoulder or between the legs make changing easier, and most pieces are machine washable.",
          "Sizes run by months (0–3, 3–6, 6–9, 9–12, 12–18, 18–24). Babies outgrow sizes fast, so buying one size ahead is common, especially for gifts.",
        ],
      },
    ],
  },
  "kids-baby-boys-0-24m": {
    intro: "Bodysuits, tops, shorts and sets for baby boys from {brands}, from {from}.",
    sections: [
      {
        heading: "Baby boys' clothes (0–24 months)",
        paragraphs: [
          "Cotton bodysuits, T-shirts, vests, shorts and joggers for baby boys from Next, H&M, Tu Clothing and M&S, many in value multipacks. Prints are playful and fabrics soft, for everyday wear and for gifting.",
          "Sizes run by months (0–3, 3–6, 6–9, 9–12, 12–18, 18–24). If you're unsure, choose the next size up: it will fit for longer.",
        ],
      },
    ],
  },
  "kids-girls-2-8-yrs": {
    intro: "Tops, sets and bottoms for girls aged 2–8 from {brands}, from {from}.",
    sections: [
      {
        heading: "Girls' clothes (2–8 years)",
        paragraphs: [
          "T-shirts, tops, leggings, shorts and two-piece sets for girls from UK high-street brands. Expect bright prints, soft cotton and practical fits for school days, play and family occasions.",
          KIDS_SIZES,
        ],
      },
    ],
  },
  "kids-boys-2-8-yrs": {
    intro: "Tops, sets and bottoms for boys aged 2–8 from {brands}, from {from}.",
    sections: [
      {
        heading: "Boys' clothes (2–8 years)",
        paragraphs: [
          "T-shirts, polos, shorts, joggers and sets for boys from Next, H&M and Tu Clothing: hard-wearing cotton made for running about, in sizes by age.",
          KIDS_SIZES,
        ],
      },
    ],
  },
  "women-dresses": {
    intro: "{count} dresses from {brands}, from {from}.",
    sections: [
      {
        heading: "Women's dresses from UK brands",
        paragraphs: [
          "Day dresses, midi and maxi styles and occasion dresses from UK high-street labels. Each product page lists the fabric and length, and the photos show the fit on the model.",
          WOMENS_SIZES,
        ],
      },
    ],
  },
  "women-lingerie": {
    intro: "Bras, knickers and lingerie sets from {brands}, from {from}.",
    sections: [
      {
        heading: "Lingerie and bras from M&S and other UK brands",
        paragraphs: [
          "M&S is the UK's best-known name for bras and underwear, alongside Debenhams, Tu Clothing and others. You'll find padded, non-wired, full-cup, bralette and sports styles, and knickers in briefs, high-leg and high-waist cuts, often in multipacks.",
          "Bra sizes are the same band numbers used in Pakistan (32, 34, 36…) with UK cup letters (A, B, C, D, DD, E, F). If a style comes up small, try one cup size up rather than a bigger band.",
        ],
      },
    ],
  },
  "women-lingerie-bras": {
    intro: "Padded, non-wired, full-cup and sports bras from {brands}, from {from}.",
    sections: [
      {
        heading: "Bras from UK brands in Pakistan",
        paragraphs: [
          "Everyday and special bras from M&S, Oysho, Tu Clothing and other UK brands: padded and push-up, non-wired for comfort, full-cup for support, bralettes and sports bras.",
          "UK bra sizes use the same band numbers as Pakistan (32, 34, 36…). Cup letters follow the UK order A, B, C, D, DD, E, F; a UK DD is the same as a US DD, but UK E is US DDD.",
        ],
      },
    ],
  },
  "women-trousers": {
    intro: "Jeans, jeggings and trousers from {brands}, from {from}.",
    sections: [{ heading: "Women's trousers and jeans", paragraphs: ["Skinny and straight jeans, jeggings, chinos and smart trousers from UK brands, many with a regular (R) or long (L) leg length after the size.", WOMENS_SIZES] }],
  },
  "women-coats-and-jackets": {
    intro: "Coats and jackets from {brands}, from {from}.",
    sections: [
      {
        heading: "Women's coats and jackets for Pakistani winters",
        paragraphs: [
          "Wool-blend coats, smart jackets and lighter layers from UK labels, cut for British winters, which makes them well suited to Lahore, Islamabad and the north from November to February.",
          WOMENS_SIZES,
        ],
      },
    ],
  },
  "men-tops": {
    intro: "Shirts, T-shirts, polos and hoodies from {brands}, from {from}.",
    sections: [{ heading: "Men's tops from UK brands", paragraphs: ["Formal and casual shirts, T-shirts, polo shirts and hoodies from Next, Burton, New Look, River Island and more.", MENS_SIZES] }],
  },
  "men-tops-t-shirts": {
    intro: "{count} T-shirts from {brands}, from {from}.",
    sections: [
      {
        heading: "Men's T-shirts, including multipacks",
        paragraphs: [
          "Plain, striped and printed T-shirts from Burton, New Look, Hollister and other UK brands, many in organic cotton and in two- or three-packs, which are the best value per T-shirt.",
          "UK T-shirts usually come in slim, regular and relaxed fits; the fit is in the product name or details. Sizes are S, M, L and XL by chest.",
        ],
      },
    ],
  },
  "men-tops-shirts": {
    intro: "Formal and casual shirts from {brands}, from {from}.",
    sections: [
      {
        heading: "Men's formal and casual shirts",
        paragraphs: [
          "Office and occasion shirts from Next and M&S, and casual checks, linens and overshirts from River Island and others. Formal shirts are often 'easy iron' cotton blends, which keep their shape in Pakistan's heat.",
          MENS_SIZES,
        ],
      },
    ],
  },
  "men-trousers": {
    intro: "Chinos, jeans, cargo and formal trousers from {brands}, from {from}.",
    sections: [{ heading: "Men's trousers, chinos and jeans", paragraphs: ["Slim, skinny, straight and relaxed fits from Next, New Look, River Island and Burton, in stretch cotton chinos, denim and smart trouser fabrics.", MENS_SIZES] }],
  },
  "men-trousers-chinos": {
    intro: "{count} chinos from {brands}, from {from}.",
    sections: [
      {
        heading: "Men's chinos",
        paragraphs: [
          "Chinos are the most versatile trouser in a UK wardrobe: smart enough for the office with a shirt, relaxed with a T-shirt. You'll find slim and straight fits from Next, New Look and River Island, usually in stretch cotton.",
          MENS_SIZES,
        ],
      },
    ],
  },
  "men-trousers-jeans": {
    intro: "{count} pairs of jeans from {brands}, from {from}.",
    sections: [{ heading: "Men's jeans", paragraphs: ["Skinny, slim and straight jeans from Next and New Look, in stretch denim for comfort.", MENS_SIZES] }],
  },
  "men-suits": {
    intro: "Suit jackets and trousers from {brands}, from {from}.",
    sections: [
      {
        heading: "Men's suits from UK brands",
        paragraphs: [
          "UK suits are sold as separate jackets and trousers, so you can take a different size in each. Jackets are sized by chest in inches (38, 40, 42…) with a length (R regular, L long), and trousers by waist and leg.",
          "Check, plain and textured suits from Next and New Look suit weddings, Eid and the office.",
        ],
      },
    ],
  },
  "men-coats-and-jackets": {
    intro: "Coats and jackets from {brands}, from {from}.",
    sections: [{ heading: "Men's coats and jackets", paragraphs: ["Padded, quilted, denim and smart jackets from Racing Green, River Island, Burton and more, built for UK winters and ideal for Pakistan's cold months.", MENS_SIZES] }],
  },
  beauty: {
    intro: "{count} makeup and beauty products from {brands} and more, from {from}.",
    sections: [
      {
        heading: "Original makeup in Pakistan",
        paragraphs: [
          "Lipsticks, foundations, concealers, mascaras, eyeliners and nail polish from Maybelline, L'Oréal Paris, NYX, Rimmel, Max Factor and other international brands, at rupee prices with cash on delivery.",
          "With makeup, buying the original matters for your skin: Urban Lane sells the brands' own products with their own shade names, so you can look up any shade on the brand's website before you order.",
        ],
      },
      {
        heading: "Choosing a shade online",
        paragraphs: [
          "Foundation and concealer shades are named and numbered by each brand (for example Maybelline Fit Me 220). If you already know your shade in one brand, search its name for a comparison chart; if not, many South Asian skin tones have warm undertones, so a slightly warmer shade is often safer than one that looks pink.",
        ],
      },
    ],
  },
  "beauty-lips": {
    intro: "{count} lipsticks, liquid lipsticks and lip products from {brands}, from {from}.",
    sections: [
      {
        heading: "Original lipstick in Pakistan",
        paragraphs: [
          "Matte, satin and liquid lipsticks and lip glosses from L'Oréal Paris, NYX, Rimmel and Maybelline, in the brands' own shades. Long-wear formulas such as Maybelline SuperStay are built to last through a full day and a meal.",
          "Each product page shows the shade name, so you can compare it with the brand's swatches before ordering.",
        ],
      },
    ],
  },
  "beauty-face": {
    intro: "Foundations, concealers, powders and highlighters from {brands}, from {from}.",
    sections: [
      {
        heading: "Original foundation and face makeup",
        paragraphs: [
          "Foundation, concealer, BB cream, blusher, powder and highlighter from Maybelline, Max Factor, Wet n Wild and more. For foundation, the shade number on the product page matches the brand's own range, so you can check it against your current shade first.",
        ],
      },
    ],
  },
  "beauty-eyes": {
    intro: "Mascaras, eyeliners and eyeshadows from {brands}, from {from}.",
    sections: [{ heading: "Original eye makeup", paragraphs: ["Mascara, kohl and liquid eyeliner, eyeshadow and brow products from Maybelline, NYX, Rimmel and other brands."] }],
  },
};

export const BRAND_GUIDES: Record<string, Guide> = {
  next: {
    intro: "{count} original Next pieces, from {from}.",
    sections: [
      {
        heading: "Next in Pakistan",
        paragraphs: [
          "Next is one of Britain's biggest clothing brands, best known for kidswear and babywear, men's shirts and chinos, and women's everyday fashion. At Urban Lane you can buy original Next in rupees with cash on delivery, and the 14-day returns are handled here in Pakistan.",
          "Next sizes: kids by age (0–3 months to 16 years), women in UK sizes (UK 10 is a US 6), men's tops by chest, and trousers by waist and leg length (R, S, L).",
        ],
      },
    ],
  },
  "h-and-m": {
    intro: "{count} original H&M pieces, from {from}.",
    sections: [
      {
        heading: "H&M kids' clothes in Pakistan",
        paragraphs: [
          "H&M, the Swedish brand found on every UK high street, is a favourite for kids' and baby clothes. Urban Lane stocks original H&M cotton sets, bodysuits, T-shirts and leggings, often in multipacks.",
          "H&M kids' sizes show both age and height (for example 1½–2 years, 92 cm), so measure your child's height for the best fit.",
        ],
      },
    ],
  },
  "m-and-s": {
    intro: "{count} original M&S pieces, from {from}.",
    sections: [
      {
        heading: "M&S (Marks & Spencer) in Pakistan",
        paragraphs: [
          "Marks & Spencer is Britain's best-known name for underwear, bras and wardrobe basics. Urban Lane stocks original M&S bras, knickers, men's underwear and shirts, and kids' basics, in rupees with cash on delivery.",
        ],
      },
    ],
  },
  "tu-clothing": {
    intro: "{count} original Tu Clothing pieces, from {from}.",
    sections: [{ heading: "Tu Clothing in Pakistan", paragraphs: ["Tu is the clothing brand of the UK supermarket Sainsbury's, popular in Britain for good-value kids' multipacks, nightwear and basics. At Urban Lane, Tu is one of the best-value ways to buy UK kidswear."] }],
  },
  "new-look": {
    intro: "{count} original New Look pieces, from {from}.",
    sections: [{ heading: "New Look in Pakistan", paragraphs: ["New Look is a British high-street fashion brand known for on-trend menswear and womenswear at friendly prices: chinos, jeans, T-shirts, shirts and suits."] }],
  },
  burton: {
    intro: "{count} original Burton menswear pieces, from {from}.",
    sections: [{ heading: "Burton menswear in Pakistan", paragraphs: ["Burton has dressed British men for over a century. Its strength is everyday menswear: T-shirts (many in organic cotton), polos, shorts, chinos and smart trousers in slim and regular fits."] }],
  },
  "river-island": {
    intro: "{count} original River Island pieces, from {from}.",
    sections: [{ heading: "River Island in Pakistan", paragraphs: ["River Island is a London fashion brand known for menswear with an edge: cargo trousers, denim jackets, chinos, casual shirts and caps. Fits tend to be slim, so check the fit in each product name."] }],
  },
  debenhams: {
    intro: "{count} original Debenhams pieces, from {from}.",
    sections: [{ heading: "Debenhams in Pakistan", paragraphs: ["Debenhams is a long-established British department-store brand. At Urban Lane you'll find Debenhams lingerie, knickers in multipacks and women's accessories such as sunglasses."] }],
  },
  maybelline: {
    intro: "{count} original Maybelline products, from {from}.",
    sections: [
      {
        heading: "Original Maybelline in Pakistan",
        paragraphs: [
          "Maybelline New York is one of the world's best-selling makeup brands: SuperStay lipsticks, Fit Me foundation and concealer, Lash Sensational and Sky High mascaras, and nail colour. Urban Lane sells the original products, so shade names and numbers match Maybelline's own range.",
        ],
      },
    ],
  },
  loreal: {
    intro: "{count} original L'Oréal Paris products, from {from}.",
    sections: [{ heading: "Original L'Oréal Paris makeup in Pakistan", paragraphs: ["Original L'Oréal Paris lipsticks, foundations and eye makeup, with prices in rupees and cash on delivery."] }],
  },
  nyx: {
    intro: "{count} original NYX Professional Makeup products, from {from}.",
    sections: [{ heading: "Original NYX in Pakistan", paragraphs: ["NYX Professional Makeup is loved for bold, long-wearing lip colours, liners and eye products at accessible prices. Urban Lane sells original NYX with the brand's own shade names, so you can check swatches before you order."] }],
  },
  rimmel: {
    intro: "{count} original Rimmel London products, from {from}.",
    sections: [{ heading: "Original Rimmel London in Pakistan", paragraphs: ["Rimmel London is a British makeup brand known for lipsticks, nail polish and eye makeup with a London attitude, sold at Urban Lane as the original products."] }],
  },
};
