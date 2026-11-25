import type { Metadata } from "next";
import Link from "next/link";
import type { RawSearchParams } from "@/lib/queries/parse-filters";
import { BLACK_FRIDAY, activeSale, saleStats } from "@/lib/sale";
import { BlackFridayHero } from "@/components/sale/BlackFridayHero";
import { SaleListing } from "@/components/sale/SaleListing";
import { SaleCountdown } from "@/components/sale/SaleCountdown";

const E = BLACK_FRIDAY;

/** The biggest discount in the sale now (the same compare-at prices as 11.11), or 0. */
async function topDiscount() {
  try {
    return (await saleStats(E.above ?? 0)).maxPct;
  } catch {
    return 0;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const pct = await topDiscount();
  return {
    title: `${E.title} Pakistan: ${pct ? `Up to ${pct}% Off` : "Discounts on"} UK Brands`,
    description: `The Urban Lane ${E.title}: ${pct ? `up to ${pct}% off ` : ""}original UK high-street clothing, ${E.firstDay} to ${E.lastDay}. Cash on delivery across Pakistan.`,
    alternates: { canonical: E.href },
  };
}

/**
 * Black Friday (lib/sale.ts → BLACK_FRIDAY): the banner film, then the sale's products while it runs.
 * Before it starts the page already shows the film and counts down to the start; afterwards it says it ended.
 */
export default async function BlackFridayPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const now = new Date();
  const sale = await activeSale();
  const running = sale?.event === E ? sale : null;
  const pct = running?.maxPct ?? (await topDiscount());
  // "27–30 November"
  const range = `${E.firstDay.replace(/^\w+day /, "").replace(/ \w+$/, "")}–${E.lastDay}`;

  if (running) {
    return (
      <>
        <BlackFridayHero line={`Up to ${pct}% off · until ${E.lastDay}`} cta={{ href: "#products", label: "Shop the sale" }} />
        <SaleListing event={E} maxPct={running.maxPct} sp={sp} />
      </>
    );
  }

  const before = now < E.starts;
  return (
    <>
      <BlackFridayHero
        line={before ? `${range} · ${pct ? `up to ${pct}% off` : "UK brands"}` : `${E.title} has ended`}
        cta={before ? { href: "#starts", label: "Starts Friday" } : undefined}
      />
      <div id="starts" className="container-site flex scroll-mt-28 flex-col items-center py-16 text-center">
        <h1 className="text-3xl font-medium md:text-4xl">{E.title}</h1>
        <p className="mt-3 max-w-md text-ink-muted">
          {before
            ? `Starts ${E.firstDay} and runs until Monday ${E.lastDay}: everything in it more than ${E.above}% off${pct ? `, up to ${pct}%` : ""}.`
            : now >= E.ends
              ? `The ${E.title} has ended. Thank you for shopping with us.`
              : // during the sale, before any product has its sale price
                `The ${E.title} prices are being added. Please check back shortly.`}
        </p>
        {before && (
          <div className="mt-8">
            <SaleCountdown ends={E.starts.getTime()} now={now.getTime()} label="Starts in" />
          </div>
        )}
        <Link href="/offers" className="btn-secondary mt-8">
          See today&apos;s offers
        </Link>
      </div>
    </>
  );
}
