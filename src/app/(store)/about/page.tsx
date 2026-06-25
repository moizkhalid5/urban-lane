import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about Urbane Lane — premium fashion, beauty and lifestyle.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <PageShell title="About Urbane Lane" intro="Premium fashion, beauty and lifestyle — curated with care.">
      <p>
        Urbane Lane brings together the labels and looks you love in one clean, considered destination. From everyday
        essentials to statement pieces, we focus on quality, fit and timeless style across womenswear, menswear, kids,
        beauty and jewellery.
      </p>
      <h2>Our promise</h2>
      <p>
        We believe shopping should feel effortless and trustworthy. That means honest pricing, secure checkout,
        reliable delivery and easy returns — so you can shop with confidence.
      </p>
      <h2>Get in touch</h2>
      <p>
        Questions? Visit our <a href="/contact">contact page</a> or browse our <a href="/faq">FAQ</a>.
      </p>
    </PageShell>
  );
}
