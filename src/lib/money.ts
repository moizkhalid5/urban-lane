/**
 * Money utilities.
 *
 * All monetary values are stored as integer MINOR units (e.g. paisa/cents) of the
 * store's BASE currency. Display conversion to other currencies + rounding happens
 * here, never in the database.
 */

export type DisplayCurrency = {
  code: string;
  symbol: string;
  flag: string;
  /** Units of this currency per 1 unit of the base currency. */
  rate: number;
  /** Round the displayed amount to a whole unit (issues-doc requirement). */
  roundWhole: boolean;
};

export const baseToMajor = (minor: number) => minor / 100;

/** Convert base-currency minor units into a display currency's major amount. */
export function convertAmount(baseMinor: number, currency: DisplayCurrency): number {
  const major = baseToMajor(baseMinor) * currency.rate;
  return currency.roundWhole ? Math.round(major) : Math.round(major * 100) / 100;
}

/** Format base-currency minor units as a localized price string in the given currency. */
export function formatMoney(baseMinor: number, currency: DisplayCurrency): string {
  const amount = convertAmount(baseMinor, currency);
  const fractionDigits = currency.roundWhole ? 0 : 2;
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${currency.symbol}${currency.symbol.length > 1 ? " " : ""}${formatted}`;
}

/** Parse a major-unit price string/number into base-currency minor units. */
export function toMinor(major: number): number {
  return Math.round(major * 100);
}

/** Percentage saved between compare-at and price (rounded), or null. */
export function discountPercent(priceMinor: number, compareAtMinor?: number | null): number | null {
  if (!compareAtMinor || compareAtMinor <= priceMinor) return null;
  return Math.round(((compareAtMinor - priceMinor) / compareAtMinor) * 100);
}
