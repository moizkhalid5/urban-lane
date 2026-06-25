import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: "Urbane Lane shipping options, timelines and costs.",
  alternates: { canonical: "/shipping-policy" },
};

export default function ShippingPolicyPage() {
  return (
    <PageShell title="Shipping Policy">
      <h2>Delivery times</h2>
      <p>Standard delivery takes 3–5 working days. Express delivery, where available, takes 1–2 working days. Orders are processed Monday to Saturday, excluding public holidays.</p>
      <h2>Shipping costs</h2>
      <p>A flat shipping fee applies to most orders. Orders above the free-shipping threshold qualify for free standard delivery — the exact figures are shown in your cart and at checkout.</p>
      <h2>Order tracking</h2>
      <p>Once your order ships, we&apos;ll email you a tracking number. You can also view order status any time from your account&apos;s Orders page.</p>
      <h2>International shipping</h2>
      <p>Availability and timelines for international destinations vary. Any customs duties or taxes are the responsibility of the recipient.</p>
    </PageShell>
  );
}
