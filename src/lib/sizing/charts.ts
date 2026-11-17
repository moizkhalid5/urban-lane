/**
 * Size charts for the product page's Size Guide, copied from the brands' own official size guides (body
 * measurements, cm; inches where the brand gives them). Checked 17 Nov 2026:
 * - Next: zendesk.next.co.uk (Women's Sizing Guides; Men's Sizing Guide; Baby and Youngsters; Older Girls/Boys)
 * - M&S: marksandspencer.com/us/sizeguides (womens-general, lingerie-knickers, lingerie-bras, kids-baby)
 * - H&M: www2.hm.com/en_gb/customer-service/sizeguide (ladies, kids; archived Jan/May 2023, H&M now shows
 *   charts only per product)
 * - River Island, New Look, Burton: their men's size guides
 * Brands without an official chart here use Next's as typical UK sizing, and the page says so.
 * Don't change a number without the brand's page to back it.
 */

export type Row = { size: string; cells: (string | number)[]; keys: string[] };
export type Table = { title: string; columns: string[]; rows: Row[] };

const r = (size: string, cells: (string | number)[], keys: (string | number)[] = [size]): Row => ({ size, cells, keys: keys.map((k) => String(k).toLowerCase()) });

/* ---------- women ---------- */

/** UK → EU / US (Next's international conversion). */
const UK_EU_US: Record<number, [number, number]> = { 4: [32, 0], 6: [34, 2], 8: [36, 4], 10: [38, 6], 12: [40, 8], 14: [42, 10], 16: [44, 12], 18: [46, 14], 20: [48, 16], 22: [50, 18], 24: [52, 20] };
const eu = (uk: number) => UK_EU_US[uk]?.[0] ?? "—";
const us = (uk: number) => (UK_EU_US[uk] && uk >= 6 ? UK_EU_US[uk][1] : "—");

const WOMEN: Record<string, [number, number, number, number][]> = {
  // UK, bust, waist, hip (cm)
  next: [[4, 76, 62.5, 83.5], [6, 80, 65, 87.5], [8, 84, 67.5, 91.5], [10, 86.5, 71, 95], [12, 90, 74, 99], [14, 94, 79, 105.5], [16, 99, 84, 110.5], [18, 104, 91.5, 117], [20, 109, 99, 123], [22, 114, 103, 127], [24, 123, 109, 131]],
  ms: [[6, 78, 61, 86], [8, 82, 65, 90], [10, 87, 70, 95], [12, 92, 75, 100], [14, 97, 80.5, 105], [16, 102.5, 86, 110], [18, 108, 92, 115], [20, 114, 98, 121], [22, 120, 104, 127], [24, 126, 110, 133]],
  hm: [[4, 76, 60, 84], [6, 80, 64, 88], [8, 84, 68, 92], [10, 88, 72, 96], [12, 92, 76, 99], [14, 96, 80, 102], [16, 100, 85, 105], [18, 104, 90, 108], [20, 110, 96, 113], [22, 116, 102, 118], [24, 122, 108, 123]],
};
/** Next's letter sizes for women (XS = 6, S = 8–10…). */
const WOMEN_LETTERS: [string, string][] = [["XS", "4–6"], ["S", "8–10"], ["M", "12–14"], ["L", "16–18"], ["XL", "20–22"], ["XXL", "24–26"]];

function womenTable(brand: "next" | "ms" | "hm"): Table {
  return {
    title: "Women's sizes (body measurements)",
    columns: ["UK", "EU", "US", "Bust (cm)", "Waist (cm)", "Hip (cm)"],
    rows: WOMEN[brand].map(([uk, b, w, h]) => r(String(uk), [uk, eu(uk), us(uk), b, w, h], [uk, `eu${eu(uk)}`])),
  };
}
const womenLetters: Table = {
  title: "Letter sizes",
  columns: ["Size", "UK size"],
  rows: WOMEN_LETTERS.map(([l, uk]) => r(l, [l, uk])),
};
const womenLegs: Table = {
  title: "Trouser leg lengths (Next)",
  columns: ["Length", "Inside leg", "For height"],
  rows: [
    r("Petite (P)", ["Petite (P)", "69 cm / 27.5 in", "150–160 cm (4'11\"–5'3\")"], ["p"]),
    r("Regular (R)", ["Regular (R)", "74 cm / 29 in", "160–167.5 cm (5'3\"–5'6\")"], ["r"]),
    r("Long (L)", ["Long (L)", "79 cm / 31 in", "167.5–177.5 cm (5'6\"–5'10\")"], ["l"]),
  ],
};

/* ---------- lingerie ---------- */

const brasBand: Table = {
  title: "Bra band size (H&M's guide)",
  columns: ["Band (UK)", "EU", "Underbust (cm)"],
  rows: [[30, 65, "63–67"], [32, 70, "68–72"], [34, 75, "73–77"], [36, 80, "78–82"], [38, 85, "83–87"], [40, 90, "88–92"], [42, 95, "93–97"], [44, 100, "98–102"]].map(([b, e, cm]) =>
    r(String(b), [b, e, cm], [b]),
  ),
};
const brasCups: Table = {
  title: "Cup sizes: UK, EU and US (Next's guide)",
  columns: ["UK", "EU", "US"],
  rows: [["A", "A", "A"], ["B", "B", "B"], ["C", "C", "C"], ["D", "D", "D"], ["DD", "E", "DD"], ["E", "F", "DDD"], ["F", "G", "DDDD/G"], ["FF", "H", "H"], ["G", "I", "I"]].map(([uk, e, u]) =>
    r(uk, [uk, e, u], [`cup-${uk.toLowerCase()}`]),
  ),
};
const knickers: Table = {
  title: "Knickers (M&S's guide)",
  columns: ["UK", "Waist (cm)", "Hip (cm)"],
  rows: [[6, 61, 84], [8, 65, 86], [10, 70, 90], [12, 75, 95], [14, 80, 100], [16, 85, 105], [18, 90, 110], [20, 96, 115]].map(([uk, w, h]) => r(String(uk), [uk, w, h], [uk])),
};

/* ---------- men ---------- */

type MenBrand = "next" | "riverisland" | "newlook" | "burton" | "ms";
const MEN_TOPS: Record<MenBrand, [string, string, string?][]> = {
  // size, chest cm, chest in
  next: [["XS", "84–89", "33–35"], ["S", "91.5–96.5", "36–38"], ["M", "99–104", "39–41"], ["L", "106.5–112", "42–44"], ["XL", "114.5–119.5", "45–47"], ["XXL", "122–127", "48–50"], ["3XL", "129.5–134.5", "51–53"]],
  riverisland: [["XS", "81–87"], ["S", "89–94"], ["M", "96–102"], ["L", "104–109"], ["XL", "113–117"], ["XXL", "119–124"], ["3XL", "127–132"]],
  newlook: [["XS", "80–87"], ["S", "88–95"], ["M", "95–102"], ["L", "103–110"], ["XL", "111–118"], ["XXL", "118–125"], ["3XL", "126–133"]],
  burton: [["XS", "86"], ["S", "91–96.5"], ["M", "101–107"], ["L", "112–117"], ["XL", "122–127"], ["XXL", "132–137"]],
  ms: [["S", "86–91"], ["M", "96–102"], ["L", "107–112"], ["XL", "117"], ["XXL", "122–127"], ["3XL", "132–137"]],
};
/** Next formal shirts: collar size (inches) → chest. The letter after a collar size is the sleeve (R regular). */
const menCollar: Table = {
  title: "Formal shirts: collar size (Next's guide)",
  columns: ["Collar (in)", "Collar (cm)", "Chest (in)", "Chest (cm)"],
  rows: [
    [14, 35.5, "33–35", "84–89"],
    [14.5, 37, "36–38", "91.5–96.5"],
    [15, 38, "36–38", "91.5–96.5"],
    [15.5, 39.5, "39–41", "99–104"],
    [16, 40.5, "42–44", "106.5–112"],
    [16.5, 42, "42–44", "106.5–112"],
    [17, 43, "45–47", "114.5–119.5"],
    [17.5, 44.5, "48–50", "122–127"],
  ].map(([c, cm, chin, chcm]) => r(String(c), [c, cm, chin, chcm], [`collar${c}`])),
};

function menTops(brand: MenBrand): Table {
  const withIn = brand === "next";
  return {
    title: "Men's tops, shirts and jackets (chest)",
    columns: withIn ? ["Size", "Chest (cm)", "Chest (in)"] : ["Size", "Chest (cm)"],
    rows: MEN_TOPS[brand].map(([s, cm, inch]) => r(s, withIn ? [s, cm, inch ?? "—"] : [s, cm], [s, s === "XXL" ? "2xl" : s])),
  };
}
/** Burton's guide gives only some waist sizes, so Burton trousers use Next's waist chart (with Burton's legs). */
const MEN_WAIST: Record<"next" | "riverisland" | "newlook", [number, string][]> = {
  next: [[28, "71"], [30, "76"], [32, "81.5"], [34, "86.5"], [36, "91.5"], [38, "96.5"], [40, "101.5"]],
  riverisland: [[28, "71"], [30, "76"], [32, "81"], [34, "86"], [36, "92"], [38, "97"], [40, "102"]],
  newlook: [[28, "69–74"], [30, "74–79"], [32, "79–84"], [34, "84–89"], [36, "89–94"], [38, "94–97"], [40, "99–104"]],
};
const MEN_LEGS: Record<Exclude<MenBrand, "ms">, [string, string][]> = {
  next: [["Short (S)", "73.5 cm / 29 in"], ["Regular (R)", "78.5 cm / 31 in"], ["Long (L)", "84 cm / 33 in"]],
  riverisland: [["Short (S)", "75 cm / 30 in"], ["Regular (R)", "80 cm / 32 in"], ["Long (L)", "85 cm / 34 in"]],
  newlook: [["Short (S)", "76 cm / 30 in"], ["Regular (R)", "81 cm / 32 in"], ["Long (L)", "86 cm / 34 in"]],
  burton: [["Short (S)", "74 cm / 29 in"], ["Regular (R)", "79 cm / 31 in"], ["Long (L)", "84 cm / 33 in"]],
};
function menWaist(brand: Exclude<MenBrand, "ms">): Table {
  const b = brand === "burton" ? "next" : brand;
  return {
    title: brand === "burton" ? "Trouser waist (Next's guide)" : "Trouser waist",
    columns: ["Waist size", "Waist (cm)"],
    rows: MEN_WAIST[b].map(([w, cm]) => r(`${w}`, [`${w} in`, cm], [w])),
  };
}
function menLegs(brand: Exclude<MenBrand, "ms">): Table {
  return { title: "Leg length (inside leg)", columns: ["Length", "Inside leg"], rows: MEN_LEGS[brand].map(([l, cm]) => r(l, [l, cm], [l.match(/\((\w)\)/)![1]])) };
}
const SUIT_CHEST: Record<"next" | "newlook" | "riverisland", [number, string][]> = {
  next: [[36, "91.5"], [38, "96.5"], [40, "101.5"], [42, "106.5"], [44, "112"], [46, "117"]],
  newlook: [[36, "89–94"], [38, "94–99"], [40, "99–104"], [42, "104–109"], [44, "109–114"], [46, "114–119"]],
  riverisland: [[36, "92"], [38, "97"], [40, "102"], [42, "107"], [44, "112"], [46, "117"]],
};
function suitJackets(brand: "next" | "newlook" | "riverisland"): Table {
  return { title: "Suit jackets (chest)", columns: ["Jacket size", "Chest (cm)"], rows: SUIT_CHEST[brand].map(([c, cm]) => r(`${c}`, [`${c} in`, cm], [c])) };
}

/* ---------- kids and baby ---------- */

const kidsNext: Table = {
  title: "Kids (Next's guide)",
  columns: ["Age", "Height (cm)", "Chest (cm)", "Waist (cm)"],
  rows: [
    r("1½–2 years", ["1½–2 years", "86–92", "51–53", "51–52"], ["y1.5"]),
    r("2–3 years", ["2–3 years", "92–98", "53–55", "52–53"], ["y2"]),
    r("3–4 years", ["3–4 years", "98–104", "55–57", "53–54"], ["y3"]),
    r("4–5 years", ["4–5 years", "104–110", "57–59", "54–55"], ["y4"]),
    r("5–6 years", ["5–6 years", "110–116", "59–61", "55–57"], ["y5"]),
    r("7 years", ["7 years", "122", "63", "58"], ["y7", "y6"]),
    r("8 years", ["8 years", "128", "66–67", "59–60"], ["y8"]),
    r("9 years", ["9 years", "134", "69–70", "61–62"], ["y9"]),
    r("10 years", ["10 years", "140", "72–73", "62–64"], ["y10"]),
  ],
};
const kidsHm: Table = {
  title: "Kids (H&M's guide: H&M sizes are the child's height in cm)",
  columns: ["H&M size", "Age", "Chest (cm)", "Waist (cm)"],
  rows: [
    r("92", ["92", "1½–2 years", "52–54", "50–52"], ["y1.5", 92]),
    r("98", ["98", "2–3 years", "54–56", "52–54"], ["y2", 98]),
    r("104", ["104", "3–4 years", "56–58", "54–55"], ["y3", 104]),
    r("110", ["110", "4–5 years", "58–60", "55–56"], ["y4", 110]),
    r("116", ["116", "5–6 years", "60–63", "56–57"], ["y5", 116]),
    r("122", ["122", "6–7 years", "63–65", "57–58"], ["y6", 122]),
    r("128", ["128", "7–8 years", "64–68", "58–61"], ["y7", 128]),
  ],
};
const babyNext: Table = {
  title: "Baby (Next's guide)",
  columns: ["Age", "Height (cm)", "Weight (kg)"],
  rows: [
    r("Up to 3 months", ["Up to 3 months", "56–62", "4.5–6"], ["m0", "m1"]),
    r("3–6 months", ["3–6 months", "62–68", "6–8"], ["m3", "m2"]),
    r("6–9 months", ["6–9 months", "68–74", "8–9.5"], ["m6", "m4"]),
    r("9–12 months", ["9–12 months", "74–80", "9.5–11"], ["m9"]),
    r("12–18 months", ["12–18 months", "80–86", "—"], ["m12"]),
    r("18–24 months", ["18–24 months", "86–92", "—"], ["m18", "y1.5"]),
  ],
};
const babyHm: Table = {
  title: "Baby (H&M's guide: H&M sizes are the baby's height in cm)",
  columns: ["H&M size", "Age", "Weight (kg)"],
  rows: [
    r("50", ["50", "0–1 month", "3"], ["m0", 50]),
    r("56", ["56", "1–2 months", "5"], ["m1", 56]),
    r("62", ["62", "2–4 months", "6"], ["m2", 62]),
    r("68", ["68", "4–6 months", "8"], ["m4", 68]),
    r("74", ["74", "6–9 months", "9"], ["m6", 74]),
    r("80", ["80", "9–12 months", "10"], ["m9", 80]),
    r("86", ["86", "12–18 months", "11"], ["m12", 86]),
    r("92", ["92", "1½–2 years", "13"], ["m18", "y1.5", 92]),
  ],
};
const babyMs: Table = {
  title: "Baby (M&S's guide)",
  columns: ["Age", "Height (cm)", "Weight (kg)"],
  rows: [
    r("1–3 months", ["1–3 months", "62", "6"], ["m1", "m0"]),
    r("3–6 months", ["3–6 months", "69", "8"], ["m3", "m2"]),
    r("6–9 months", ["6–9 months", "72", "9"], ["m6", "m4"]),
    r("9–12 months", ["9–12 months", "76", "10"], ["m9"]),
    r("12–18 months", ["12–18 months", "83", "11"], ["m12"]),
    r("18–24 months", ["18–24 months", "90", "12.5"], ["m18", "y1.5"]),
  ],
};

/* ---------- choosing ---------- */

export type SizeGuide = {
  tables: Table[];
  /** whose measurements these are, shown under the tables */
  source: string;
  /** how to measure and how to choose */
  tips: string[];
};

const brandKey = (brand: string | null | undefined) => {
  const b = (brand ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (b === "next") return "next";
  if (b === "ms" || b.startsWith("marks")) return "ms";
  if (b === "hm") return "hm";
  if (b === "riverisland") return "riverisland";
  if (b === "newlook") return "newlook";
  if (b === "burton") return "burton";
  return null;
};
const BRAND_NAME: Record<string, string> = { next: "Next", ms: "M&S", hm: "H&M", riverisland: "River Island", newlook: "New Look", burton: "Burton" };

/**
 * Turns a product's size labels into keys that match chart rows: "10", "10P"/"10R" → "10" (+ leg "p"/"r");
 * "32B" → band "32" + "cup-b"; "32R" → "32" + "r"; "S"/"Small" → "s"; "M/L" → "m","l"; "6-9 Months" → "m6";
 * "2-3 Years"/"2-3Y"/"1½-2Y" → "y2"/"y1.5"; H&M heights "92" stay "92".
 */
export function sizeKeys(sizes: string[]): Set<string> {
  const keys = new Set<string>();
  const words: Record<string, string> = { xsmall: "xs", small: "s", medium: "m", large: "l", xlarge: "xl", xxlarge: "xxl" };
  for (const raw of sizes) {
    const s = raw.toLowerCase().replace(/½/g, ".5").replace(/\s+/g, " ").trim();
    let m: RegExpMatchArray | null;
    const months = (n: number) => keys.add(`m${n}`);
    const years = (n: number) => {
      keys.add(`y${n}`);
      if (n === 1) keys.add("m12"); // "1–1½ years" is the 12–18 months size
    };
    if (/^(first size|newborn|tiny baby)$/.test(s) || ((m = s.match(/^(\d+(?:\.\d+)?)\s*kg$/)) && parseFloat(m[1]) <= 4.5)) keys.add("m0");
    else if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(m|mths?|months?)$/))) months(parseFloat(m[1]));
    else if ((m = s.match(/^up\s*to\s*(\d+)\s*(m|mths?|months?)$/))) keys.add("m0");
    else if ((m = s.match(/^(\d+)\s*(m|mths?|months?)$/))) months(parseFloat(m[1]));
    else if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(y|yrs?|years?)$/))) years(parseFloat(m[1]));
    else if ((m = s.match(/^(\d+)\s*(y|yrs?|years?)$/))) years(parseInt(m[1]));
    else if ((m = s.match(/^w\s*(\d{2})\s*,?\s*l\s*(\d{2})$/))) {
      keys.add(m[1]); // "W34 L30": waist 34, inside leg 30 in
      keys.add(`leg${m[2]}`);
    } else if ((m = s.match(/^(1[3-9](?:\.5)?)\s*([srl])?$/)) && (s.includes(".") || m[2])) {
      keys.add(`collar${parseFloat(m[1])}`); // formal shirt collar, e.g. "14.5R"…
      keys.add(String(parseFloat(m[1]))); // …or a UK size with a leg length, e.g. women's "14R"
      if (m[2]) keys.add(m[2]);
    }
    else if ((m = s.match(/^(\d{2})\s*([a-h]{1,2})$/))) {
      keys.add(m[1]);
      keys.add(`cup-${m[2]}`);
    } else if ((m = s.match(/^(\d{1,2})\s*([psrl])$/))) {
      keys.add(m[1]);
      keys.add(m[2]);
    } else if (/^\d{1,3}$/.test(s)) {
      keys.add(s);
      keys.add(`eu${s}`); // continental sizes (women's coats in 34–44)
      if (+s >= 14 && +s <= 18) keys.add(`collar${s}`);
    }
    else for (const part of s.split("/")) keys.add(words[part.replace(/[^a-z]/g, "")] ?? part.replace(/[^a-z0-9]/g, ""));
  }
  return keys;
}

/**
 * The size guide for a product, from its department, category and brand, or null when sizes don't apply
 * (beauty, accessories without sizes).
 */
export function sizeGuideFor(p: { brand: string | null; categorySlugs: string[]; department: string | null; title: string; sizes: string[] }): SizeGuide | null {
  const slugs = p.categorySlugs.join(" ");
  const dept = p.department;
  if (!dept || dept === "beauty" || dept === "jewellery" || !p.sizes.length) return null;
  if (/sunglasses|wallets|bags|hats|caps|cufflinks|watches/.test(slugs)) return null;
  const b = brandKey(p.brand);
  const keys = sizeKeys(p.sizes);
  const own = (name: string) => `Measurements from ${name}'s official size guide.`;
  const typical = `Typical UK sizing, from Next's official size guide${p.brand ? `; ${p.brand} may vary slightly` : ""}.`;

  if (dept === "kids") {
    const baby = [...keys].some((k) => k.startsWith("m")) || /baby|0-24m/.test(slugs);
    const kids = [...keys].some((k) => k.startsWith("y") && k !== "y1.5") || /(girls|boys)-\d/.test(slugs);
    const tables: Table[] = [];
    if (baby) tables.push(b === "hm" ? babyHm : b === "ms" ? babyMs : babyNext);
    if (kids || !baby) tables.push(b === "hm" ? kidsHm : kidsNext);
    return {
      tables,
      source: b === "hm" || b === "next" || (b === "ms" && baby && !kids) ? own(BRAND_NAME[b]) : typical,
      tips: [
        "Go by your child's height first, then age: children of the same age can be very different sizes.",
        "If your child is between sizes or near the top of a range, choose the next size up for room to grow.",
      ],
    };
  }

  if (dept === "women") {
    if (/lingerie-bras|(^|-)bras(-|$)/.test(slugs) && [...keys].some((k) => k.startsWith("cup-"))) {
      return {
        tables: [brasBand, brasCups],
        source: "Band measurements from H&M's official guide; cup conversions from Next's. UK bra sizes use the same band numbers as Pakistan.",
        tips: [
          "Band: measure snugly around your ribcage, just under your bust, and find it in the first table.",
          "Cup: UK cups go A, B, C, D, DD, E, F, FF, G. Sister sizes hold the same cup volume: if the band feels loose, go down one band and up one cup (34C → 32D); if it feels tight, up one band and down one cup (34C → 36B).",
        ],
      };
    }
    if (/knickers|briefs|thongs/.test(slugs)) {
      return {
        tables: [knickers, womenLetters],
        source: "Knicker measurements from M&S's official size guide; letter sizes from Next's.",
        tips: ["Measure your waist at its narrowest and your hips at their fullest, and choose the size that fits your hips."],
      };
    }
    const tables = [womenTable(b === "ms" ? "ms" : b === "hm" ? "hm" : "next")];
    if ([...keys].some((k) => ["xs", "s", "m", "l", "xl", "xxl"].includes(k))) tables.push(womenLetters);
    if (/trousers|jeans|jeggings|leggings|chinos/.test(slugs) || keys.has("p") || keys.has("r") || /petite/i.test(p.title)) tables.push(womenLegs);
    return {
      tables,
      source: b === "ms" || b === "hm" || b === "next" ? own(BRAND_NAME[b]) : typical,
      tips: [
        "Bust: around the fullest part. Waist: around the narrowest part. Hip: around the fullest part, about 20 cm below the waist.",
        ...(keys.has("p") || /petite/i.test(p.title)
          ? ["Petite (P) is for women 5'3\" (160 cm) and under: dresses and skirts are shorter, sleeves up to 4 cm shorter and the inside leg 5 cm shorter."]
          : []),
        "Between two sizes? Choose by your largest measurement, or size up for coats you'll layer over.",
      ],
    };
  }

  // men
  const mb: Exclude<MenBrand, "ms"> = b === "riverisland" || b === "newlook" || b === "burton" ? b : "next";
  const letterOnly = [...keys].every((k) => ["xs", "s", "m", "l", "xl", "xxl", "2xl", "3xl"].includes(k));
  if ([...keys].some((k) => k.startsWith("collar")) && /shirt/.test(`${slugs} ${p.title.toLowerCase()}`)) {
    return {
      tables: [menCollar],
      source: b === "next" ? own("Next") : typical,
      tips: [
        "Collar: measure around the base of your neck where the collar sits, and add about 1 cm (½ inch) for comfort.",
        "The letter after the collar size is the sleeve length: R is regular.",
      ],
    };
  }
  if (/suits-jackets|suit-jackets/.test(slugs) || (/suits/.test(slugs) && [...keys].some((k) => /^\d{2}$/.test(k) && +k >= 34))) {
    if (/suits-trousers/.test(slugs)) {
      return {
        tables: [menWaist(mb), menLegs(mb)],
        source: b === mb && mb !== "burton" ? own(BRAND_NAME[mb]) : typical,
        tips: ["Waist: measure where you wear your trousers. Inside leg: from the crotch seam to the ankle bone."],
      };
    }
    const sb = b === "newlook" || b === "riverisland" ? b : "next";
    return {
      tables: [suitJackets(sb)],
      source: b === "newlook" || b === "riverisland" || b === "next" ? own(BRAND_NAME[sb]) : typical,
      tips: [
        "Suit jackets are sized by chest in inches: measure around the fullest part of your chest, under your arms.",
        "The letter is the length: R is regular, S shorter and L longer (on Next's 40-inch jacket the sleeve is 77.5 cm S, 80.5 cm R, 83.5 cm L).",
      ],
    };
  }
  // shorts and underwear in letter sizes: no official chart collected, so none rather than a wrong one
  if (letterOnly && /trousers|shorts|underwear|boxers|briefs|trunks/.test(slugs)) return null;
  if (/trousers|jeans|chinos|joggers|cargo|shorts|formal-pants/.test(slugs) || [...keys].some((k) => /^(2[6-9]|3\d|4[0-4])$/.test(k))) {
    return {
      tables: [menWaist(mb), menLegs(mb)],
      source: mb === "burton" ? "Leg lengths from Burton's official size guide; waist sizes from Next's." : b === mb ? own(BRAND_NAME[mb]) : typical,
      tips: [
        "Waist: measure where you wear your trousers. 32R means a 32-inch waist with a regular leg.",
        ...([...keys].some((k) => k.startsWith("leg")) ? ["W34 L30 means a 34-inch waist and a 30-inch inside leg."] : []),
        "Inside leg: from the crotch seam to the ankle bone.",
      ],
    };
  }
  const tb: MenBrand = b === "riverisland" || b === "newlook" || b === "burton" || b === "ms" ? b : "next";
  return {
    tables: [menTops(tb)],
    source: b ? (tb === b ? own(BRAND_NAME[tb]) : typical) : typical,
    tips: [
      "Chest: measure around the fullest part of your chest, under your arms, keeping the tape level.",
      ...(tb === "burton" ? ["Burton's sizes run about one size bigger than Next's."] : []),
      "Between two sizes? Take the larger one for a relaxed fit or for jackets worn over jumpers.",
    ],
  };
}
