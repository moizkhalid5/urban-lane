/**
 * Kids' size labels → age ranges. Sizes in the catalogue are free text from the
 * master sheet ("9-12M", "12-18 Months", "UP TO 3 M", "First Size", "1½-2Y",
 * "6-8 year", "11 Years", "3.2kg" …). Keep dependency-free (also used by prisma scripts).
 */

/** Age range in months covered by a size label, or null if it isn't a kids' age size. */
export function sizeAgeMonths(raw: string): [number, number] | null {
  const lower = raw.toLowerCase().replace(/½/g, ".5").replace(/\s+/g, " ").trim();
  if (/first size|newborn|\bkg\b|\d\s?kg/.test(lower)) return [0, 1];
  const upTo = lower.match(/up ?to ?(\d+(?:\.\d+)?)\s?m/);
  if (upTo) return [0, parseFloat(upTo[1])];

  const s = lower.replace(/\bto\b/g, "-"); // "1 to 1.5 Y" → "1 - 1.5 Y"
  const m = s.match(/^(?:(\d+(?:\.\d+)?)\s?-\s?)?(\d+(?:\.\d+)?)\s?(m|mths?|months?|y|yrs?|years?)\b/);
  if (!m) return null;
  const perUnit = m[3].startsWith("y") ? 12 : 1;
  const hi = parseFloat(m[2]);
  if (m[1] !== undefined) return [parseFloat(m[1]) * perUnit, hi * perUnit];
  // A single age ("4 Years") is that whole year of age.
  return perUnit === 12 ? [hi * 12, hi * 12 + 12] : [hi, hi];
}

/** "Shop by age" bands on the Kids page (months; upper bound exclusive). Keys are used in ?ages=. */
export const AGE_BANDS = [
  { key: "0-12m", label: "0-12 Months", from: 0, to: 12 },
  { key: "1-2y", label: "1-2 Years", from: 12, to: 24 },
  { key: "2-4y", label: "2-4 Years", from: 24, to: 60 },
  { key: "5-7y", label: "5-7 Years", from: 60, to: 96 },
  { key: "7-10y", label: "7-10 Years", from: 84, to: 132 },
  { key: "10y", label: "10+ Years", from: 120, to: Infinity },
] as const;

/** True if any of the sizes overlaps one of the selected age bands. */
export function sizesMatchAges(sizes: string[], bandKeys: string[]): boolean {
  const bands = AGE_BANDS.filter((b) => bandKeys.includes(b.key));
  return sizes.some((size) => {
    const r = sizeAgeMonths(size);
    // A point range (e.g. "3 M") still counts towards the band it falls in.
    return !!r && bands.some((b) => (r[0] === r[1] ? r[0] >= b.from && r[0] < b.to : r[0] < b.to && r[1] > b.from));
  });
}
