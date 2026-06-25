import type { Coupon, SiteSettings } from "@prisma/client";

export type OrderTotals = {
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  freeShipping: boolean;
};

/**
 * Compute order totals from a subtotal, store settings and an optional coupon.
 * Shipping is flat unless the free-shipping threshold is met; FREE_SHIPPING
 * coupons also zero it. All values are base-currency minor units.
 */
export function computeTotals(
  subtotalCents: number,
  settings: Pick<SiteSettings, "flatShippingCents" | "freeShippingThresholdCents">,
  coupon?: Pick<Coupon, "type" | "value"> | null,
): OrderTotals {
  const threshold = settings.freeShippingThresholdCents;
  let freeShipping = threshold != null && subtotalCents >= threshold;

  let discountCents = 0;
  if (coupon) {
    if (coupon.type === "PERCENTAGE") {
      discountCents = Math.round((subtotalCents * coupon.value) / 100);
    } else if (coupon.type === "FIXED") {
      discountCents = Math.min(coupon.value, subtotalCents);
    } else if (coupon.type === "FREE_SHIPPING") {
      freeShipping = true;
    }
  }

  const shippingCents = subtotalCents === 0 || freeShipping ? 0 : settings.flatShippingCents;
  const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;

  return { subtotalCents, shippingCents, discountCents, totalCents, freeShipping };
}
