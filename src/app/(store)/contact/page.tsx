import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/settings";
import { ContactForm } from "@/components/forms/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the Urban Lane team.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const settings = await getSiteSettings();
  return (
    <div className="container-site py-12">
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1fr_320px]">
        <div>
          <h1 className="text-3xl font-medium md:text-4xl">Contact Us</h1>
          <p className="mt-3 text-ink-muted">We usually respond within one business day.</p>
          <div className="mt-8">
            <ContactForm />
          </div>
        </div>
        <aside className="space-y-6 text-sm">
          <div>
            <h2 className="font-medium">Customer care</h2>
            <p className="mt-1 text-ink-muted">{settings.storeEmail}</p>
            {settings.supportPhone && <p className="text-ink-muted">{settings.supportPhone}</p>}
          </div>
          <div>
            <h2 className="font-medium">Returns</h2>
            <p className="mt-1 text-ink-muted">
              For returns or refunds, please use our <a href="/returns" className="underline">returns form</a>.
            </p>
          </div>
          <div>
            <h2 className="font-medium">Help</h2>
            <p className="mt-1 text-ink-muted">
              Browse the <a href="/faq" className="underline">FAQ</a> for quick answers.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
