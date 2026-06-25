import "server-only";
import { cookies } from "next/headers";
import { CURRENCY_COOKIE, getCurrencies, getBaseCurrency } from "@/lib/settings";
import type { DisplayCurrency } from "@/lib/money";

/** Read the active display currency for the current request (cookie → base). */
export async function getActiveCurrency(): Promise<DisplayCurrency> {
  const code = (await cookies()).get(CURRENCY_COOKIE)?.value;
  const currencies = await getCurrencies();
  return currencies.find((c) => c.code === code) ?? (await getBaseCurrency());
}
