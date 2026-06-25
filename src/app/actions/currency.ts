"use server";

import { cookies } from "next/headers";
import { CURRENCY_COOKIE, getCurrencies } from "@/lib/settings";

/** Persist the chosen display currency in a cookie (validated against enabled list). */
export async function setCurrency(code: string) {
  const currencies = await getCurrencies();
  if (!currencies.some((c) => c.code === code)) return { ok: false };
  (await cookies()).set(CURRENCY_COOKIE, code, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return { ok: true };
}
