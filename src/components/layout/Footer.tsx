import Link from "next/link";
import { NewsletterForm } from "./NewsletterForm";
import { InstagramLink, PhoneLink, SocialLinks, TikTokLink, WhatsAppLink } from "./SocialContact";

const shopLinks = [
  { name: "Women", href: "/collections/women" },
  { name: "Men", href: "/collections/men" },
  { name: "Kids", href: "/collections/kids" },
  { name: "Beauty", href: "/collections/beauty" },
  { name: "Jewellery", href: "/collections/jewellery" },
  { name: "Outlet", href: "/collections/outlet" },
  { name: "Brands", href: "/brands" },
];

const helpLinks = [
  { name: "Contact Us", href: "/contact" },
  { name: "FAQ", href: "/faq" },
  { name: "Shipping Policy", href: "/shipping-policy" },
  { name: "Returns & Refunds", href: "/returns" },
  { name: "Track Your Order", href: "/account/orders" },
];

const aboutLinks = [
  { name: "About Us", href: "/about" },
  { name: "Privacy Policy", href: "/privacy-policy" },
  { name: "Terms & Conditions", href: "/terms" },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-white">
      {/* newsletter band */}
      <div className="bg-ink text-white">
        <div className="container-site grid gap-6 py-12 md:grid-cols-2 md:items-center">
          <div>
            <h3 className="text-xl font-medium text-white">Join the Urban Lane list</h3>
            <p className="mt-1 text-sm text-white/70">
              New arrivals, exclusive offers and style edits — straight to your inbox.
            </p>
          </div>
          <NewsletterForm />
        </div>
      </div>

      {/* links */}
      <div className="container-site grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="text-lg font-semibold uppercase tracking-[0.2em]">
            Urban Lane
          </Link>
          <p className="mt-3 max-w-xs text-sm text-ink-muted">
            Premium fashion, beauty and lifestyle. Curated essentials, delivered with care.
          </p>
          <div className="mt-5 flex flex-col items-start gap-3 text-sm text-ink-soft">
            <PhoneLink />
            <WhatsAppLink size={18} label />
            <InstagramLink size={18} label />
            <TikTokLink size={18} label />
          </div>
        </div>
        <FooterCol title="Shop" links={shopLinks} />
        <FooterCol title="Help" links={helpLinks} />
        <FooterCol title="Company" links={aboutLinks} />
      </div>

      {/* payment band (issues doc) */}
      <div className="border-t border-line">
        <div className="container-site flex flex-col items-center gap-3 py-6 text-center text-sm text-ink-muted">
          <p>
            We accept <strong className="text-ink">Cash on Delivery</strong>,{" "}
            <strong className="text-ink">Easypaisa</strong> and <strong className="text-ink">JazzCash</strong>.
          </p>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-site flex flex-col items-center justify-between gap-2 py-5 text-xs text-ink-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Urban Lane. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <PhoneLink />
            <SocialLinks />
          </div>
          <p>Designed & built in-house.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { name: string; href: string }[] }) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink">{title}</h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
              {l.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
