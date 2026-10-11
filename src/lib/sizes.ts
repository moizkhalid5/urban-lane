/**
 * Size labels come from the master sheet in many spellings ("14 R"/"14R", "LARGE"/"Large"/"L",
 * "W34, L30"/"W34 L30", "One"/"ONE SIZE"). Filters show one normalised label per size and
 * match every raw spelling that normalises to it. Keep dependency-free.
 */

const WORDS: Record<string, string> = {
  "X-SMALL": "XS", "EXTRA SMALL": "XS", SMALL: "S", MEDIUM: "M", LARGE: "L",
  "X-LARGE": "XL", "EXTRA LARGE": "XL", "XX-LARGE": "XXL", "XXX-LARGE": "XXXL",
  ONE: "One Size", "ONE SIZE": "One Size", ONESIZE: "One Size", "FIRST SIZE": "First Size",
};

export function normalizeSize(raw: string): string {
  let s = raw.trim().replace(/\s+/g, " ").replace(/½/g, ".5").toUpperCase();
  if (WORDS[s]) return WORDS[s];
  s = s.replace(/,/g, "");                       // "W34, L30" → "W34 L30"
  s = s.replace(/^(\d+(?:\.5)?) ([RSLP]|[A-H]{1,2})$/, "$1$2"); // "14 R" → "14R", bra "85 B" → "85B"
  s = s.replace(/^(\d+(?:\.\d+)?) TO (\d)/, "$1-$2"); // "1 TO 1.5 Y" → "1-1.5 Y"
  // Kids' ages keep readable casing: "2-3 YEARS" → "2-3 Years", "12-18 M" → "12-18 Months".
  const age = s.match(/^(UP TO ?)?([\d.½]+(?: ?- ?[\d.½]+)?) ?(M|MTHS?|MONTHS?|Y|YRS?|YEARS?)$/);
  if (age) {
    const unit = age[3].startsWith("Y") ? "Years" : "Months";
    return `${age[1] ? "Up to " : ""}${age[2].replace(/ ?- ?/, "-")} ${unit}`;
  }
  return s;
}

const LETTER_ORDER = ["XXS", "XS", "S", "S/M", "M", "M/L", "L", "XL", "XXL", "XXXL"];

/** Sort key: letter sizes in wearing order, then numbers ascending, then everything else. */
export function compareSizes(a: string, b: string): number {
  const la = LETTER_ORDER.indexOf(a);
  const lb = LETTER_ORDER.indexOf(b);
  if (la >= 0 || lb >= 0) return la < 0 ? 1 : lb < 0 ? -1 : la - lb;
  const na = parseFloat(a.replace(/^[A-Z ]+/, ""));
  const nb = parseFloat(b.replace(/^[A-Z ]+/, ""));
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
}
