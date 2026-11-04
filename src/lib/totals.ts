import type { Coupon, SiteSettings } from "@prisma/client";

export type OrderTotals = {
  subtotalCents: number;
  shippingCents: number;
  /** all discounts: the colour-bundle saving plus any coupon */
  discountCents: number;
  /** the colour-bundle part of discountCents (lib/bundle-rule.ts) */
  bundleCents: number;
  totalCents: number;
  freeShipping: boolean;
};

/**
 * Compute order totals from a subtotal, store settings and an optional coupon.
 * Shipping is flat unless the free-shipping threshold is met; FREE_SHIPPING
 * coupons also zero it. A colour-bundle saving (`bundleCents`) comes off first; a percentage or fixed
 * coupon then applies to what is left. All values are base-currency minor units.
 */
export function computeTotals(
  subtotalCents: number,
  settings: Pick<SiteSettings, "flatShippingCents" | "freeShippingThresholdCents">,
  coupon?: Pick<Coupon, "type" | "value"> | null,
  bundleCents = 0,
): OrderTotals {
  const bundle = Math.max(0, Math.min(bundleCents, subtotalCents));
  const afterBundle = subtotalCents - bundle;
  const threshold = settings.freeShippingThresholdCents;
  let freeShipping = threshold != null && subtotalCents >= threshold;

  let discountCents = bundle;
  if (coupon) {
    if (coupon.type === "PERCENTAGE") {
      discountCents += Math.round((afterBundle * coupon.value) / 100);
    } else if (coupon.type === "FIXED") {
      discountCents += Math.min(coupon.value, afterBundle);
    } else if (coupon.type === "FREE_SHIPPING") {
      freeShipping = true;
    }
  }

  const shippingCents = subtotalCents === 0 || freeShipping ? 0 : settings.flatShippingCents;
  const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;

  return { subtotalCents, shippingCents, discountCents, bundleCents: bundle, totalCents, freeShipping };
}
