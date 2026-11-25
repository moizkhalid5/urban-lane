import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/guards";
import { getSiteSettings } from "@/lib/settings";
import { CreateOrderForm } from "@/components/admin/orders/CreateOrderForm";
import type { CustomerOption } from "@/app/actions/admin-manual-orders";

export const dynamic = "force-dynamic";

/** Admin → Orders → Create order: record a sale (WhatsApp, Instagram, the shop, before the website...) on the day it happened. */
export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  await requireStaff();
  const { customer: customerId } = await searchParams;
  const [settings, u] = await Promise.all([
    getSiteSettings(),
    customerId
      ? prisma.user.findUnique({
          where: { id: customerId },
          select: { id: true, name: true, email: true, profile: { select: { phone: true } }, addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }], take: 1 } },
        })
      : null,
  ]);
  const a = u?.addresses[0];
  const customer: CustomerOption | null = u
    ? {
        id: u.id,
        name: u.name ?? "",
        email: u.email,
        phone: u.profile?.phone ?? a?.phone ?? null,
        address: a ? { line1: a.line1, line2: a.line2, city: a.city, postalCode: a.postalCode } : null,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-ink-muted hover:text-ink">← Orders</Link>
        <h1 className="mt-1 text-2xl font-medium">Create order</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-soft">
          Record a sale made on WhatsApp, Instagram, in person or before the website, on the day it happened. It counts in sales, the
          Dashboard and Analytics like any other order.
        </p>
      </div>
      <CreateOrderForm
        shippingRule={{
          flat: Math.round(settings.flatShippingCents / 100),
          freeFrom: settings.freeShippingThresholdCents == null ? null : Math.round(settings.freeShippingThresholdCents / 100),
        }}
        initialCustomer={customer}
      />
    </div>
  );
}
