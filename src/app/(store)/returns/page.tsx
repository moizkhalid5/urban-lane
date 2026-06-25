import type { Metadata } from "next";
import { RefundForm } from "@/components/forms/RefundForm";

export const metadata: Metadata = {
  title: "Returns & Refunds",
  description: "Start a return or refund request with Urbane Lane.",
  alternates: { canonical: "/returns" },
};

export default function ReturnsPage() {
  return (
    <div className="container-site py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-medium md:text-4xl">Returns &amp; Refunds</h1>
        <p className="mt-3 text-ink-muted">
          Not quite right? You have 14 days from delivery to request a return. Items must be unworn, with tags
          attached and in their original packaging.
        </p>

        <div className="mt-8 space-y-3 text-sm leading-relaxed text-ink-soft">
          <h2 className="text-lg font-medium text-ink">How it works</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Submit the form below with your order number and reason.</li>
            <li>Our team reviews your request and emails you the next steps.</li>
            <li>Once we receive and inspect the item, your refund is processed to the original payment method.</li>
          </ol>
        </div>

        <div className="mt-10 border border-line p-6">
          <h2 className="mb-4 text-lg font-medium">Start a return / refund request</h2>
          <RefundForm />
        </div>
      </div>
    </div>
  );
}
