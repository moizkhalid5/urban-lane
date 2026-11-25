import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { RawSearchParams } from "@/lib/queries/parse-filters";
import { SALE, activeSale } from "@/lib/sale";
import { SaleBanner } from "@/components/sale/SaleBanner";
import { SaleListing } from "@/components/sale/SaleListing";

/** "11.11 Sale Pakistan: Up to 63% Off UK Brands", with the real top discount while the sale runs. */
export async function generateMetadata(): Promise<Metadata> {
  const sale = await activeSale();
  const off = sale?.maxPct ? `Up to ${sale.maxPct}% Off` : "Discounts on";
  return {
    title: `${SALE.title} Pakistan: ${off} UK Brands`,
    description: `The Urban Lane ${SALE.title}: ${sale?.maxPct ? `up to ${sale.maxPct}% off ` : ""}original UK high-street clothing and makeup, until ${SALE.lastDay}. Cash on delivery across Pakistan.`,
    alternates: { canonical: SALE.href },
  };
}

/**
 * The 11.11 sale (lib/sale.ts): every product discounted in Admin, i.e. with a compare-at price above its
 * price (components/sale/SaleListing.tsx). While another sale runs (Black Friday), /sale leads to it.
 */
export default async function SalePage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const sale = await activeSale();
  if (sale && sale.event !== SALE) redirect(sale.event.href);

  if (!sale) {
    return (
      <div className="container-site flex flex-col items-center py-24 text-center">
        <h1 className="text-3xl font-medium">{SALE.title}</h1>
        <p className="mt-3 max-w-md text-ink-muted">
          {new Date() < SALE.starts
            ? `The ${SALE.title} starts on ${SALE.firstDay}. See you then!`
            : new Date() >= SALE.ends
              ? `The ${SALE.title} has ended. Thank you for shopping with us.`
              : // during the sale, before any product has its sale price
                `The ${SALE.title} prices are being added. Please check back shortly.`}
        </p>
        <Link href="/offers" className="btn-secondary mt-6">
          See today&apos;s offers
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Edge to edge under the menu. On phones it fills the screen, so it steps aside once a filter is chosen. */}
      <SaleBanner
        href="#products"
        label={`See the ${SALE.title} products`}
        hideOnPhones={Object.keys(sp).some((k) => k !== "page")}
      />
      <SaleListing event={SALE} maxPct={sale.maxPct} sp={sp} />
    </>
  );
}
