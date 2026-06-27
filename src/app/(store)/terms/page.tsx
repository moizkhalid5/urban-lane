import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms governing your use of Urban Lane.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PageShell title="Terms & Conditions">
      <h2>Use of the site</h2>
      <p>By accessing and using Urban Lane, you agree to these terms. You must be at least 18 years old, or have permission from a parent or guardian, to place an order.</p>
      <h2>Orders & pricing</h2>
      <p>All orders are subject to acceptance and availability. We reserve the right to refuse or cancel an order. Prices are shown in your selected currency and may be rounded for display; the charged amount is calculated at checkout.</p>
      <h2>Payments</h2>
      <p>We accept the payment methods shown at checkout. Card details are never stored by us and are handled by our payment providers.</p>
      <h2>Returns</h2>
      <p>Returns are governed by our <a href="/returns">returns policy</a>.</p>
      <h2>Liability</h2>
      <p>To the fullest extent permitted by law, Urban Lane is not liable for indirect or consequential losses arising from the use of the site.</p>
    </PageShell>
  );
}
