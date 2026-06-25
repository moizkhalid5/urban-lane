import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { getCart } from "@/lib/cart";
import { getActiveCurrency } from "@/lib/currency.server";
import { getSiteSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/totals";
import { formatMoney } from "@/lib/money";
import { availablePaymentMethods } from "@/lib/payments/available";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const cart = await getCart();
  if (cart.lines.length === 0) redirect("/cart");

  const [currency, settings, user] = await Promise.all([
    getActiveCurrency(),
    getSiteSettings(),
    getCurrentUser(),
  ]);

  const totals = computeTotals(cart.subtotalCents, settings);
  const methods = availablePaymentMethods(settings, totals.totalCents);

  // Prefill from the user's default address when signed in.
  let prefill: Record<string, string | undefined> = { email: user?.email ?? undefined };
  if (user) {
    const addr = await prisma.address.findFirst({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    if (addr) {
      prefill = {
        email: user.email ?? undefined,
        firstName: addr.firstName,
        lastName: addr.lastName,
        phone: addr.phone ?? undefined,
        line1: addr.line1,
        line2: addr.line2 ?? undefined,
        city: addr.city,
        state: addr.state ?? undefined,
        postalCode: addr.postalCode,
        country: addr.country,
      };
    }
  }

  return (
    <div className="container-site py-10">
      <h1 className="text-3xl font-medium">Checkout</h1>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_400px]">
        <div>
          <CheckoutForm
            paymentMethods={methods.map((m) => ({ method: m.method, label: m.label }))}
            bankInstructions={settings.bankTransferInstructions}
            prefill={prefill}
          />
        </div>

        {/* Order summary */}
        <aside className="h-fit border border-line p-6 lg:sticky lg:top-28">
          <h2 className="text-lg font-medium">Your order</h2>
          <ul className="mt-5 divide-y divide-line">
            {cart.lines.map((l) => (
              <li key={l.id} className="flex gap-3 py-3">
                <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-line-soft">
                  {l.image && <Image src={l.image} alt={l.title} fill sizes="48px" className="object-cover" />}
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-medium">{l.title}</p>
                  {l.variantLabel && <p className="text-ink-muted">{l.variantLabel}</p>}
                  <p className="text-ink-muted">Qty {l.quantity}</p>
                </div>
                <p className="text-sm">{formatMoney(l.lineTotalCents, currency)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{formatMoney(totals.subtotalCents, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Shipping</dt>
              <dd>{totals.shippingCents === 0 ? "Free" : formatMoney(totals.shippingCents, currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-medium">
              <dt>Total</dt>
              <dd>{formatMoney(totals.totalCents, currency)}</dd>
            </div>
          </dl>
          {settings.codLimitCents > 0 && (
            <p className="mt-4 text-xs text-ink-muted">
              Cash on delivery available for orders up to {formatMoney(settings.codLimitCents, currency)}.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
