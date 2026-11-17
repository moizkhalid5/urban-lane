import Link from "next/link";
import type { Guide } from "@/lib/seo/content";
import type { ListingStats } from "@/lib/seo/stats";
import { rupees } from "@/lib/seo/meta";

/**
 * Under a category's or brand's products: its buying guide (lib/seo/content.ts), links to the brands and
 * sections inside it, and answers to the questions shoppers in Pakistan ask before ordering. The answers
 * are built from the shop's live settings (delivery charge, free-delivery threshold, cash-on-delivery limit),
 * so they always match checkout. Plain HTML (<details>), so all of it is readable to search engines.
 */

export type ShopPolicy = { flatShippingCents: number; freeShippingThresholdCents: number | null; codLimitCents: number };

type Tokens = { count: number; from: string; brands: string; freeOver: string; flat: string };

export function fillTokens(text: string, t: Tokens) {
  return text
    .replace(/\{count\}/g, String(t.count))
    .replace(/\{from\}/g, t.from)
    .replace(/\{brands\}/g, t.brands)
    .replace(/\{freeOver\}/g, t.freeOver)
    .replace(/\{flat\}/g, t.flat);
}

export function tokensFor(stats: ListingStats, shop: ShopPolicy): Tokens {
  const names = stats.brands.slice(0, 3).map((b) => b.name);
  return {
    count: stats.count,
    from: stats.minCents != null ? rupees(stats.minCents) : "",
    brands: names.length <= 1 ? (names[0] ?? "UK high-street brands") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`,
    freeOver: shop.freeShippingThresholdCents != null ? rupees(shop.freeShippingThresholdCents) : "",
    flat: rupees(shop.flatShippingCents),
  };
}

/** The intro line under the page heading, or null when there's no guide for the page. */
export function guideIntro(guide: Guide | undefined, stats: ListingStats, shop: ShopPolicy) {
  if (!guide?.intro || !stats.count) return null;
  // "{count} pieces" reads oddly for one or two products
  const intro = stats.count < 3 ? guide.intro.replace(/^\{count\}\s+/, "").replace(/^./, (c) => c.toUpperCase()) : guide.intro;
  return fillTokens(intro, tokensFor(stats, shop));
}

function shopFaqs(t: Tokens, shop: ShopPolicy) {
  return [
    {
      q: "Are the products original?",
      a: `Yes. Urban Lane sells original products from UK high-street brands such as ${t.brands}. Every product page names the brand and shows the item's details and photos.`,
    },
    {
      q: "Can I pay cash on delivery?",
      a: `Yes. Pay cash on delivery anywhere in Pakistan${shop.codLimitCents > 0 ? ` on orders up to ${rupees(shop.codLimitCents)}` : ""}, or pay by Easypaisa or JazzCash.`,
    },
    {
      q: "How long does delivery take, and what does it cost?",
      a: `Standard delivery takes 3–5 working days. ${
        shop.freeShippingThresholdCents != null ? `It's free on orders over ${t.freeOver}, and ${t.flat} below that.` : `Delivery is ${t.flat} per order.`
      }`,
    },
    {
      q: "Can I return something?",
      a: "Yes, and returns are free: within 14 days of delivery, as long as it's unworn, with its tags attached and in its original packaging. Start a return from the Returns page.",
    },
  ];
}

export function ListingGuide({
  label,
  guide,
  stats,
  shop,
  brandLinks = [],
  sectionLinks = [],
}: {
  /** The page's full name, e.g. "Women's Dresses" or "Next". */
  label: string;
  guide?: Guide;
  stats: ListingStats;
  shop: ShopPolicy;
  brandLinks?: { name: string; href: string }[];
  sectionLinks?: { name: string; href: string }[];
}) {
  if (!stats.count) return null;
  const t = tokensFor(stats, shop);
  const faqs = [...(guide?.faqs ?? []), ...shopFaqs(t, shop)];

  return (
    <section className="mt-20 grid gap-12 border-t border-line pt-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" aria-label={`About ${label}`}>
      <div className="space-y-8">
        {guide?.sections.map((s) => (
          <div key={s.heading}>
            <h2 className="text-xl font-medium">{fillTokens(s.heading, t)}</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              {s.paragraphs.map((p, i) => (
                <p key={i}>{fillTokens(p, t)}</p>
              ))}
            </div>
          </div>
        ))}

        {brandLinks.length > 0 && (
          <div>
            <h2 className="text-lg font-medium">Shop {label} by brand</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {brandLinks.map((b) => (
                <li key={b.href}>
                  <Link href={b.href} className="inline-block border border-line px-3.5 py-1.5 text-sm transition-colors hover:border-ink">
                    {b.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {sectionLinks.length > 0 && (
          <div>
            <h2 className="text-lg font-medium">More to explore</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {sectionLinks.map((c) => (
                <li key={c.href}>
                  <Link href={c.href} className="inline-block border border-line px-3.5 py-1.5 text-sm transition-colors hover:border-ink">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-medium">Questions before you order</h2>
        <div className="mt-3 divide-y divide-line border-y border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group py-3.5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="mt-0.5 shrink-0 text-ink-muted transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {f.a.includes("Returns page") ? (
                  <>
                    {f.a.replace(" Start a return from the Returns page.", "")} Start a return from the{" "}
                    <Link href="/returns" className="underline underline-offset-2">
                      Returns page
                    </Link>
                    .
                  </>
                ) : (
                  f.a
                )}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
