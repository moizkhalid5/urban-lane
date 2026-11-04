"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { ensureBundleTables, getBundleConfig } from "@/lib/bundles";
import { colourKey } from "@/lib/bundle-rule";
import { addToCart, type CartActionResult } from "@/app/actions/cart";

export type BundleResult = { ok: boolean; message?: string };

/** Admin → Settings → Colour bundles. */
export async function setBundleSettings(input: unknown): Promise<BundleResult> {
  const user = await requireAdmin();
  const parsed = z
    .object({
      enabled: z.boolean(),
      minColours: z.coerce.number().int().min(2, "A bundle needs at least 2 colours.").max(10, "At most 10 colours."),
      percentOff: z.coerce.number().int().min(1, "Enter a discount of 1% or more.").max(90, "At most 90% off."),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the settings." };
  await ensureBundleTables();
  await prisma.bundleSettings.upsert({ where: { id: "singleton" }, update: parsed.data, create: { id: "singleton", ...parsed.data } });
  await logAudit(user.id, "settings.bundles", "BundleSettings", "singleton", parsed.data);
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

/**
 * Product page → "Add bundle to bag": one of each chosen colour (variants of one product, all different
 * colours). The saving itself is worked out in the bag, so it can never differ from what checkout charges.
 */
export async function addBundleToCart(variantIds: unknown): Promise<CartActionResult> {
  const parsed = z.array(z.string().min(1).max(64)).min(2).max(20).safeParse(variantIds);
  if (!parsed.success) return { ok: false, message: "Choose the colours for your bundle." };
  const config = await getBundleConfig();
  if (!config.enabled) return { ok: false, message: "Colour bundles aren't available right now." };

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: parsed.data }, isActive: true },
    select: { id: true, productId: true, color: true, stock: true },
  });
  const colours = new Set(variants.filter((v) => v.color?.trim()).map((v) => colourKey(v.color!)));
  if (
    variants.length !== parsed.data.length ||
    new Set(variants.map((v) => v.productId)).size !== 1 ||
    colours.size !== variants.length ||
    colours.size < config.minColours
  ) {
    return { ok: false, message: `Choose at least ${config.minColours} different colours.` };
  }
  if (variants.some((v) => v.stock <= 0)) return { ok: false, message: "One of those colours has just sold out. Please choose again." };

  let last: CartActionResult = { ok: false };
  for (const id of parsed.data) {
    last = await addToCart({ variantId: id, quantity: 1 });
    if (!last.ok) return last;
  }
  return { ok: true, count: last.count, message: `Added ${variants.length} colours to your bag, ${config.percentOff}% off applied.` };
}
