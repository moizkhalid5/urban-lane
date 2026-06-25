import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { Accordion } from "@/components/ui/Accordion";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about ordering, shipping, payments and returns.",
  alternates: { canonical: "/faq" },
};

const faqs = [
  { title: "How do I track my order?", content: "Sign in and visit your account's Orders page. Once your order ships, you'll receive an email with tracking details." },
  { title: "What payment methods do you accept?", content: "We accept Cash on Delivery, Bank Transfer, and (where enabled) card and PayPal. PayPal payments are accepted in GBP or USD only. Cash on delivery is available for orders up to Rs 10,000." },
  { title: "How long does delivery take?", content: "Standard delivery takes 3–5 working days. Express delivery (where available) takes 1–2 working days." },
  { title: "Do you offer free shipping?", content: "Yes — orders over the free-shipping threshold qualify for free standard delivery. The threshold is shown in your cart." },
  { title: "What is your return policy?", content: "We offer easy 14-day returns on most items. Submit a request via our returns page and our team will guide you through the process." },
  { title: "How do I choose the right size?", content: "Each product page includes a size guide. If you're between sizes, we generally recommend sizing up, or contact us for help." },
];

export default function FaqPage() {
  return (
    <PageShell title="Frequently Asked Questions">
      <Accordion items={faqs} defaultOpen={-1} />
    </PageShell>
  );
}
