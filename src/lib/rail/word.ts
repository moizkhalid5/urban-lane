/** Garment words for the big word behind the rail, most specific first ("puffer jacket" → "puffer"). */
const WORDS: [RegExp, string][] = [
  [/\btrench\b/i, "trench"],
  [/\bpuffer|quilted|padded\b/i, "puffer"],
  [/\bblazer|suit jacket\b/i, "blazer"],
  [/\bhoodie|hoody\b/i, "hoodie"],
  [/\bcoat\b/i, "coat"],
  [/\bjacket\b/i, "jacket"],
  [/\bsweatshirt|jumper|sweater|cardigan\b/i, "knit"],
  [/\bjeans\b/i, "jeans"],
  [/\bchinos?\b/i, "chinos"],
  [/\btrousers?|pants|joggers\b/i, "trousers"],
  [/\bdress\b/i, "dress"],
  [/\bt-shirt|tee\b/i, "tee"],
  [/\bshirt\b/i, "shirt"],
  [/\bskirt\b/i, "skirt"],
];

/** The word shown behind the rail: the admin's choice, or a garment word from the product name. */
export function railWord(word: string | null | undefined, title: string | null | undefined): string {
  if (word?.trim()) return word.trim().toLowerCase();
  const t = title ?? "";
  return WORDS.find(([re]) => re.test(t))?.[1] ?? "new in";
}
