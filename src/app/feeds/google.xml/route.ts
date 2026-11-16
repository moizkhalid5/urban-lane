import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/site";
import { getSiteSettings } from "@/lib/settings";
import { googleCategoryId } from "@/lib/seo/taxonomy";
import { departmentOf, plainText } from "@/lib/seo/copy";
import { brandedTitle } from "@/lib/seo/meta";

export const dynamic = "force-dynamic";

/**
 * Google Merchant Center product feed (RSS 2.0 with the g: namespace), fetched on a schedule by Merchant
 * Center: Products → Add products → "Add products from a file" → "Enter a link to your file"
 * → https://urbanlane.uk/feeds/google.xml (daily).
 *
 * One item per live size/colour (what Google Shopping matches on), grouped by item_group_id; the price and
 * sale price are exactly what the product page shows; shipping per item follows the shop's flat fee and
 * free-shipping threshold. The shop has no barcodes (GTIN), so items carry brand + mpn (the retailer's
 * product code) where there is one, or identifier_exists = no.
 */

const esc = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const tag = (name: string, value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? "" : `<g:${name}>${esc(String(value))}</g:${name}>`;
const money = (cents: number, currency: string) => `${(cents / 100).toFixed(2)} ${currency}`;
/** Colour words product names contain ("Next Teal Dress"), for clothing with no colour recorded. */
const COLOURS = [
  "black", "white", "navy", "blue", "red", "pink", "green", "grey", "gray", "brown", "beige", "cream", "khaki", "stone", "teal",
  "yellow", "orange", "purple", "lilac", "burgundy", "ivory", "tan", "camel", "charcoal", "mint", "coral", "rust", "olive", "sage",
  "multi", "gold", "silver", "nude", "natural", "indigo", "denim", "mustard", "plum", "rose", "turquoise", "aqua", "lavender", "maroon",
];
function colourFromTitle(title: string): string | null {
  const words = title.toLowerCase().split(/[^a-z]+/);
  const found = COLOURS.filter((c) => words.includes(c));
  if (!found.length) return null;
  const name = (c: string) => (c === "multi" ? "Multicolour" : c === "gray" ? "Grey" : c[0].toUpperCase() + c.slice(1));
  return found.slice(0, 3).map(name).join("/");
}

const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : `${APP_URL}${encodeURI(path)}`);

export async function GET() {
  const [settings, products] = await Promise.all([
    getSiteSettings(),
    prisma.product.findMany({
      where: { status: "ACTIVE", images: { some: {} } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        details: true,
        sku: true,
        gender: true,
        priceCents: true,
        compareAtCents: true,
        trackInventory: true,
        brand: { select: { name: true } },
        images: { orderBy: { position: "asc" }, take: 11, select: { url: true } },
        categories: { select: { category: { select: { name: true, slug: true, level: true, isVirtual: true } } } },
        variants: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          select: { id: true, sku: true, size: true, color: true, stock: true, image: true, priceCents: true },
        },
      },
    }),
  ]);
  const currency = settings.baseCurrency || "PKR";
  const shipping = (cents: number) =>
    settings.freeShippingThresholdCents != null && cents >= settings.freeShippingThresholdCents ? 0 : settings.flatShippingCents;

  const items: string[] = [];
  for (const p of products) {
    const cats = p.categories
      .map((c) => c.category)
      .filter((c) => !c.isVirtual)
      .sort((a, b) => b.level - a.level);
    const dept = departmentOf(p.gender, cats.map((c) => c.slug));
    const slugs = cats.map((c) => c.slug);
    const deepest = cats[0];
    const brand = p.brand?.name ?? "";
    const baseTitle = brandedTitle(p);
    const description =
      [plainText(p.description), plainText(p.details)].filter(Boolean).join("\n\n") ||
      `${baseTitle}. An original ${brand || "UK high-street"} product, delivered across Pakistan with cash on delivery.`;
    const isApparel = dept !== "beauty";
    // Required for clothing in free listings; a product filed under both Women and Men is unisex.
    const gender =
      dept === "women" ? "female" : dept === "men" ? "male" : dept === "kids" ? (slugs.some((s) => /girls/.test(s)) ? "female" : slugs.some((s) => /boys/.test(s)) ? "male" : "unisex") : "unisex";
    const ageGroup = dept === "kids" ? (slugs.some((s) => /baby|0-24m/.test(s)) ? "infant" : "kids") : "adult";
    const titleColour = colourFromTitle(p.title);
    const productType = cats.length ? [...new Set([dept && dept[0].toUpperCase() + dept.slice(1), deepest?.name])].filter(Boolean).join(" > ") : null;
    const googleCategory = googleCategoryId(slugs);
    const images = p.images.map((i) => absolute(i.url));

    // One entry per live variant; a product without variants is one entry.
    const variants = p.variants.length ? p.variants : [null];
    for (const v of variants) {
      const price = v?.priceCents ?? p.priceCents;
      const onSale = !!p.compareAtCents && p.compareAtCents > price;
      const inStock = !p.trackInventory || !v || v.stock > 0;
      // "– Black, Size M" for variants, leaving out what the name already says
      const variantBits = (p.variants.length > 1 ? [v?.color?.trim(), v?.size?.trim() && `Size ${v.size.trim()}`] : []).filter(
        (bit): bit is string => !!bit && !baseTitle.toLowerCase().includes(bit.toLowerCase()),
      );
      const title = (variantBits.length ? `${baseTitle} – ${variantBits.join(", ")}` : baseTitle).slice(0, 150);
      const image = v?.image ? absolute(v.image) : images[0];
      const mpn = v?.sku || p.sku;
      items.push(
        [
          "<item>",
          tag("id", v ? (v.sku || v.id) : p.sku || p.id),
          p.variants.length > 1 ? tag("item_group_id", p.sku || p.id) : "",
          `<title>${esc(title)}</title>`,
          `<description>${esc(description.slice(0, 5000))}</description>`,
          `<link>${esc(`${APP_URL}/products/${p.slug}`)}</link>`,
          tag("image_link", image),
          ...images.filter((i) => i !== image).slice(0, 10).map((i) => tag("additional_image_link", i)),
          tag("availability", inStock ? "in_stock" : "out_of_stock"),
          tag("price", money(onSale ? p.compareAtCents! : price, currency)),
          onSale ? tag("sale_price", money(price, currency)) : "",
          tag("condition", "new"),
          tag("brand", brand),
          mpn ? tag("mpn", mpn) : tag("identifier_exists", "no"),
          tag("google_product_category", googleCategory),
          tag("product_type", productType),
          isApparel ? tag("gender", gender) : "",
          isApparel ? tag("age_group", ageGroup) : "",
          tag("color", v?.color?.trim() || (isApparel ? titleColour : null)),
          tag("size", v?.size?.trim()),
          isApparel && v?.size ? tag("size_system", "UK") : "",
          `<g:shipping>${tag("country", "PK")}${tag("service", "Standard")}${tag("price", money(shipping(price), currency))}${tag("min_transit_time", 3)}${tag("max_transit_time", 5)}</g:shipping>`,
          tag("min_handling_time", 1),
          tag("max_handling_time", 2),
          "</item>",
        ].join(""),
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${esc(settings.storeName)}</title>
<link>${esc(APP_URL)}</link>
<description>${esc(`${settings.storeName}: original UK high-street brands, delivered across Pakistan`)}</description>
${items.join("\n")}
</channel>
</rss>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900, s-maxage=900" },
  });
}
