import type { Metadata } from "next";
import { getBaseCurrency } from "@/lib/settings";
import { APP_URL } from "@/lib/site";
import { STORE_PHONE, STORE_PHONE_TEL } from "@/components/layout/SocialContact";
import { WholesaleCatalogue } from "@/components/wholesale/WholesaleCatalogue";
import { getWholesaleSettings } from "@/lib/wholesale/prospects";
import { getWholesaleStock } from "@/lib/wholesale/stock";
import { WHOLESALE_OFFER } from "@/lib/wholesale/offer";

/**
 * Wholesale page for business owners (shops, resellers): what we have in stock and how many pieces, by brand
 * and department, with wholesale prices, and an order they build and send to us on WhatsApp.
 *
 * Shared by link only (Admin → Wholesale, and the outreach messages): not in the menu or the sitemap, and
 * hidden from search engines, so retail shoppers don't come across the wholesale discounts.
 */
export const metadata: Metadata = {
  title: "Wholesale: original UK high-street stock in bulk",
  description: "Buy original UK high-street brands in bulk for your shop: live stock by brand, 40% off, or flat 50% off on 100+ pieces.",
  robots: { index: false, follow: false },
};

/**
 * WhatsApp number for orders: the one in Admin → Wholesale settings, else the shop's. Digits, international.
 * Only the first number counts if several were typed in.
 */
function whatsappDigits(setting: string) {
  let d = setting.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `92${d.slice(1)}`;
  d = d.startsWith("92") ? d.slice(0, 12) : d.slice(0, 15);
  return d.length >= 11 ? d : STORE_PHONE_TEL.replace(/\D/g, "");
}

export default async function WholesalePage() {
  const [stock, currency, settings] = await Promise.all([getWholesaleStock(), getBaseCurrency(), getWholesaleSettings()]);
  const whatsapp = whatsappDigits(settings.yourWhatsApp);
  const phoneShown = whatsapp === STORE_PHONE_TEL.replace(/\D/g, "") ? STORE_PHONE : `+${whatsapp}`;
  const o = WHOLESALE_OFFER;
  const fmt = (n: number) => n.toLocaleString("en-US");
  // the brands with the most pieces, e.g. "Next, M&S, H&M, River Island and 14 more"
  const names = stock.brands.filter((b) => b.name !== "Other brands").map((b) => b.name);
  const topBrands = names.length > 4 ? `${names.slice(0, 4).join(", ")} and ${names.length - 4} more brands` : names.join(", ") || "UK high-street brands";
  const hello = encodeURIComponent("Assalam-o-Alaikum Urban Lane, I'm interested in buying wholesale for my shop.");

  return (
    <>
      {/* Hero: the wholesale banner. On computers the text sits on the banner's dark left side (which already
          reads "URBANLANE WHOLESALE"); on phones and tablets a crop showing the clothes sits above the text. */}
      <section className="relative overflow-hidden bg-[#1a1512] text-white lg:min-h-[33.4vw]">
        <div className="relative aspect-[1272/724] w-full lg:absolute lg:inset-x-0 lg:top-0 lg:aspect-[2172/724]">
          <picture>
            <source media="(min-width: 1024px)" type="image/avif" srcSet="/images/banners/wholesale-desktop-v2.avif" />
            <source media="(min-width: 1024px)" type="image/webp" srcSet="/images/banners/wholesale-desktop-v2.webp" />
            <source type="image/avif" srcSet="/images/banners/wholesale-phone-v2.avif" />
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised artwork, served as is */}
            <img
              src="/images/banners/wholesale-phone-v2.webp"
              alt="Clothes on a rail: Urban Lane wholesale"
              width={1272}
              height={724}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </picture>
          {/* the photo fades into the brown below it */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#1a1512] to-transparent" />
          {/* computers: keeps the text readable where it reaches the clothes on wide screens */}
          <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-r from-[#1a1512]/60 via-[#1a1512]/20 to-transparent lg:block" />
        </div>
        <div className="container-site relative pb-14 pt-6 md:pb-20 lg:pt-[max(7rem,7vw)]">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/60 lg:hidden">Urban Lane wholesale</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-medium leading-tight text-white md:text-5xl lg:mt-0 lg:max-w-xl">
            Original UK high-street stock, in bulk, for your shop
          </h1>
          <p className="mt-4 max-w-2xl text-white/75 md:text-lg lg:max-w-xl">
            {topBrands}, for shops and resellers across Pakistan. See exactly what we have and how many pieces, then send your order on
            WhatsApp.
          </p>
          <dl className="mt-10 grid max-w-3xl grid-cols-3 gap-3 lg:max-w-xl">
            {[
              [fmt(stock.pieces), "pieces in stock"],
              [fmt(stock.styles), "styles"],
              [fmt(stock.brands.length), "brands"],
            ].map(([n, label]) => (
              <div key={label} className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <dt className="sr-only">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums md:text-4xl">{n}</dd>
                <dd className="mt-1 text-xs text-white/70 md:text-sm">{label}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#stock" className="rounded-full bg-white px-6 py-3 text-sm font-medium text-ink transition hover:bg-white/90">
              See the stock
            </a>
            <a
              href={`https://wa.me/${whatsapp}?text=${hello}`}
              target="_blank"
              rel="noopener"
              className="rounded-full border border-white/40 px-6 py-3 text-sm font-medium transition hover:bg-white/10"
            >
              WhatsApp {phoneShown}
            </a>
            <a href="/wholesale/stock.csv" className="rounded-full border border-white/40 px-6 py-3 text-sm font-medium transition hover:bg-white/10">
              Download the stock list (Excel)
            </a>
          </div>
        </div>
      </section>

      {/* The offer */}
      <section className="container-site py-12" aria-labelledby="offer-heading">
        <h2 id="offer-heading" className="sr-only">
          Wholesale prices
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line p-6 md:p-8">
            <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">Under {o.bulkMinPieces} pieces</p>
            <p className="mt-2 text-5xl font-semibold md:text-6xl">{o.basePct}% off</p>
            <p className="mt-3 text-ink-soft">Off our shop prices on every piece, from your first order.</p>
          </div>
          <div className="rounded-2xl bg-success p-6 text-white md:p-8">
            <p className="text-sm font-medium uppercase tracking-wide text-white/80">{o.bulkMinPieces} pieces or more</p>
            <p className="mt-2 text-5xl font-semibold md:text-6xl">Flat {o.bulkPct}% off</p>
            <p className="mt-3 text-white/85">Half our shop price on the whole order. Mix any products, sizes and brands: the total counts.</p>
          </div>
        </div>
      </section>

      <WholesaleCatalogue
        items={stock.items}
        brands={stock.brands}
        departments={stock.departments}
        currency={currency}
        whatsapp={whatsapp}
        siteUrl={APP_URL}
      />

      {/* How it works */}
      <section className="container-site py-14" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-2xl font-medium md:text-3xl">
          How ordering works
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Pick your pieces", "Choose quantities in the stock list above. Your price updates as you go, and reaches flat 50% off at 100 pieces."],
            ["Send it on WhatsApp", "One tap sends us your list with quantities and prices. Add your business name and city."],
            ["We confirm and deliver", "We check the stock, confirm the final total with you and arrange delivery to your city."],
          ].map(([title, text], n) => (
            <li key={title} className="rounded-2xl border border-line p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{n + 1}</span>
              <p className="mt-4 font-medium">{title}</p>
              <p className="mt-1 text-sm text-ink-soft">{text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-ink-muted">
          Stock is shown live from our shop and can sell out; we confirm every order before it&apos;s final. Prices are in Pakistani rupees.
        </p>
      </section>
    </>
  );
}
