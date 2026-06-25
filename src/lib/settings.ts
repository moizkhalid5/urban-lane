import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { DisplayCurrency } from "@/lib/money";

export const SETTINGS_ID = "singleton";

/** Load (and lazily create) the singleton site settings row. Per-request cached. */
export const getSiteSettings = cache(async () => {
  const existing = await prisma.siteSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return prisma.siteSettings.create({ data: { id: SETTINGS_ID } });
});

/** All enabled display currencies, ordered. Per-request cached. */
export const getCurrencies = cache(async (): Promise<DisplayCurrency[]> => {
  const rows = await prisma.currency.findMany({
    where: { isEnabled: true },
    orderBy: { position: "asc" },
  });
  if (rows.length === 0) {
    // Safe fallback if currencies were not seeded yet.
    return [{ code: "PKR", symbol: "Rs", flag: "🇵🇰", rate: 1, roundWhole: true }];
  }
  return rows.map((c) => ({
    code: c.code,
    symbol: c.symbol,
    flag: c.flag,
    rate: c.rate,
    roundWhole: c.roundWhole,
  }));
});

export const getBaseCurrency = cache(async (): Promise<DisplayCurrency> => {
  const currencies = await getCurrencies();
  return currencies.find((c) => c.code === "PKR") ?? currencies[0];
});

/** Resolve the active display currency from a code (falls back to base). */
export async function resolveCurrency(code?: string | null): Promise<DisplayCurrency> {
  const currencies = await getCurrencies();
  return currencies.find((c) => c.code === code) ?? (await getBaseCurrency());
}

export const CURRENCY_COOKIE = "ul_currency";
