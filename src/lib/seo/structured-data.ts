import { APP_URL } from "@/lib/site";
import { INSTAGRAM_URL, STORE_PHONE_TEL, TIKTOK_URL } from "@/components/layout/SocialContact";
import { clip, prose } from "@/lib/seo/copy";

/**
 * schema.org structured data (JSON-LD), shaped to Google's current documentation (Nov 2026):
 * - merchant listings: developers.google.com/search/docs/appearance/structured-data/merchant-listing
 * - shop-wide returns + shipping: …/structured-data/return-policy, …/structured-data/shipping-policy
 * - organisation and site name: …/structured-data/organization, …/appearance/site-names
 * Every figure here is what the shop actually offers (Shipping and Returns pages, Admin → Settings);
 * keep them in step if a policy changes.
 */

const ORG_ID = `${APP_URL}/#organization`;
const SHIPPING_ID = `${APP_URL}/#shipping`;

/** Delivery, from the Shipping Policy page: processed within a working day, 3–5 working days in transit. */
const HANDLING_DAYS = { min: 0, max: 1 };
const TRANSIT_DAYS = { min: 3, max: 5 };
/** Returns, from the Returns page: 14 days from delivery, sent back by courier, free (as in Merchant Center). */
const RETURN_DAYS = 14;

export type ShippingSettings = { flatShippingCents: number; freeShippingThresholdCents: number | null; baseCurrency: string };

const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : `${APP_URL}${encodeURI(path)}`);
const major = (cents: number) => Math.round(cents) / 100;
const days = (r: { min: number; max: number }) => ({ "@type": "QuantitativeValue", minValue: r.min, maxValue: r.max, unitCode: "DAY" });
/** Profile links without tracking parameters. */
const clean = (url: string) => url.split("?")[0];

const returnPolicy = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "PK",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: RETURN_DAYS,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/FreeReturn",
};

/** The shop itself (homepage): who it is, how to reach it, and its shop-wide shipping and returns. */
export function organizationLd(settings: ShippingSettings & { storeName: string }) {
  const currency = settings.baseCurrency || "PKR";
  const threshold = settings.freeShippingThresholdCents;
  const condition = (rateCents: number, orderValue?: Record<string, unknown>) => ({
    "@type": "ShippingConditions",
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "PK" },
    ...(orderValue && { orderValue: { "@type": "MonetaryAmount", currency, ...orderValue } }),
    shippingRate: { "@type": "MonetaryAmount", value: major(rateCents), currency },
    transitTime: { "@type": "ServicePeriod", duration: days(TRANSIT_DAYS) },
  });
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": ORG_ID,
    name: settings.storeName || "Urban Lane",
    alternateName: "UrbanLane",
    url: APP_URL,
    logo: `${APP_URL}/icon.png`,
    description: "Online store for original UK high-street brands (Next, H&M, M&S, River Island, Maybelline and more), delivered across Pakistan with cash on delivery.",
    areaServed: { "@type": "Country", name: "Pakistan" },
    currenciesAccepted: currency,
    paymentAccepted: "Cash on delivery, Easypaisa, JazzCash",
    telephone: STORE_PHONE_TEL,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: STORE_PHONE_TEL,
      contactType: "customer support",
      areaServed: "PK",
      availableLanguage: ["en", "ur"],
    },
    sameAs: [clean(INSTAGRAM_URL), clean(TIKTOK_URL)],
    hasMerchantReturnPolicy: returnPolicy,
    hasShippingService: {
      "@type": "ShippingService",
      "@id": SHIPPING_ID,
      name: "Standard delivery across Pakistan",
      handlingTime: { "@type": "ServicePeriod", duration: days(HANDLING_DAYS) },
      shippingConditions:
        threshold != null
          ? [condition(settings.flatShippingCents, { maxValue: major(threshold) - 0.01 }), condition(0, { minValue: major(threshold) })]
          : [condition(settings.flatShippingCents)],
    },
  };
}

/** Site name shown in Google results (homepage only). */
export function websiteLd(name: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: name || "Urban Lane",
    alternateName: ["UrbanLane", "urbanlane.uk"],
    url: `${APP_URL}/`,
    publisher: { "@id": ORG_ID },
  };
}

type LdProduct = {
  title: string;
  slug: string;
  description: string | null;
  details: string | null;
  sku: string | null;
  priceCents: number;
  compareAtCents: number | null;
  brand: { name: string } | null;
  images: { url: string }[];
  variants: { color: string | null; stock: number }[];
  trackInventory: boolean;
};

/**
 * A product page as a Google merchant listing. Prices are in the shop's base currency (what Google's crawler
 * sees), the sale's crossed-out price as a StrikethroughPrice, and the delivery charge for this item on its
 * own (free when it alone passes the free-shipping threshold).
 */
export function productLd(p: LdProduct, settings: ShippingSettings, rating?: { average: number; count: number }) {
  const currency = settings.baseCurrency || "PKR";
  const onSale = !!p.compareAtCents && p.compareAtCents > p.priceCents;
  const inStock = !p.trackInventory || p.variants.length === 0 || p.variants.some((v) => v.stock > 0);
  const colours = [...new Set(p.variants.map((v) => v.color?.trim()).filter(Boolean))];
  const free = settings.freeShippingThresholdCents != null && p.priceCents >= settings.freeShippingThresholdCents;
  const description = prose(p.description) || prose(p.details);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    image: p.images.map((i) => absolute(i.url)),
    ...(description && { description: clip(description, 5000) }),
    ...(p.sku && { sku: p.sku.replace(/\s+/g, "") }),
    ...(p.brand && { brand: { "@type": "Brand", name: p.brand.name } }),
    ...(colours.length === 1 && { color: colours[0] }),
    offers: {
      "@type": "Offer",
      url: `${APP_URL}/products/${p.slug}`,
      price: major(p.priceCents),
      priceCurrency: currency,
      ...(onSale && {
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          priceType: "https://schema.org/StrikethroughPrice",
          price: major(p.compareAtCents!),
          priceCurrency: currency,
        },
      }),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": ORG_ID },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: free ? 0 : major(settings.flatShippingCents), currency },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "PK" },
        deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: days(HANDLING_DAYS), transitTime: days(TRANSIT_DAYS) },
      },
      hasMerchantReturnPolicy: returnPolicy,
    },
    ...(rating &&
      rating.count > 0 && {
        aggregateRating: { "@type": "AggregateRating", ratingValue: Number(rating.average.toFixed(1)), reviewCount: rating.count, bestRating: 5, worstRating: 1 },
      }),
  };
}

/** Breadcrumb trail (product, collection and brand pages). The current page may be the last item. */
export function breadcrumbLd(items: { name: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absolute(c.href) })),
  };
}
