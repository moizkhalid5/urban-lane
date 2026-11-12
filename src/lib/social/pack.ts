import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/site";
import { SALE } from "@/lib/sale";
import { discountPercent } from "@/lib/money";

/**
 * Admin → Marketing → Social pack: a CSV of product posts for a social media scheduler (made for Publer's
 * bulk upload: up to 500 posts per file), so the catalogue can be posted to Instagram/Facebook a few posts a
 * day without the Instagram API. Each row: the date and time, a caption from the product's live details, and
 * links to its photos as Instagram-ready JPEGs (/api/social-image/<id>.jpg).
 * A post shows one product (its photos) or a collection: up to 10 products of one department, one photo each,
 * as a swipeable carousel, so the catalogue gets posted ten times faster at the same posting pace.
 * Products put in a pack are remembered (SocialPost), so the next pack carries on with the rest, and can start
 * right after the last pack's final post.
 */

export const SOCIAL_TABLE = `CREATE TABLE IF NOT EXISTS \`SocialPost\` (
    \`productId\` VARCHAR(191) NOT NULL,
    \`scheduledFor\` DATETIME(3) NOT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`productId\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

let ready: Promise<unknown> | null = null;
export function ensureSocialTable() {
  ready ??= prisma.$executeRawUnsafe(SOCIAL_TABLE).catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

export const MAX_POSTS = 500;
/** Instagram carousels hold up to 10 pictures. */
export const PER_COLLECTION = 10;
export type Order = "sale" | "newest" | "popular";
export type PerPost = "product" | "collection";

export type PackOptions = {
  start: string; // YYYY-MM-DD, Pakistan time
  days: number;
  times: string[]; // HH:MM, Pakistan time
  photos: number; // photos per post in "product" mode (1 = single photo, 2-10 = carousel)
  perPost: PerPost; // one product per post, or up to 10 products (one photo each)
  maxPosts: number; // posts in the file (Publer's free plan takes 5 per file)
  continueAfterLast: boolean; // start right after the last remembered post, instead of `start`
  order: Order;
  mix: boolean; // alternate departments
  hashtags: string;
  includeScheduled: boolean;
};

/** Departments, by key: Product.gender in lower case (stored as "Women", "Men"…) or a top-level category name. */
const DEPARTMENT: Record<string, { label: string; tag: string; picks: string; emoji: string }> = {
  women: { label: "Women", tag: "#WomensFashion", picks: "Women's picks", emoji: "👗" },
  men: { label: "Men", tag: "#MensFashion", picks: "Men's picks", emoji: "👔" },
  kids: { label: "Kids", tag: "#KidsFashion", picks: "Kids' picks", emoji: "🧸" },
  beauty: { label: "Beauty", tag: "#Beauty", picks: "Beauty picks", emoji: "💄" },
  jewellery: { label: "Jewellery", tag: "#Jewellery", picks: "Jewellery picks", emoji: "💍" },
};
const deptOf = (p: { dept: string }) => DEPARTMENT[p.dept];

/**
 * A product's department key: its gender, or else the department its categories name (beauty products have
 * no gender, only the "Beauty" category). "" when unknown or ambiguous (filed under both Women and Men).
 */
function departmentKey(gender: string | null, categories: string[]) {
  const g = gender?.toLowerCase() ?? "";
  if (DEPARTMENT[g]) return g;
  const named = [...new Set(categories.map((c) => c.toLowerCase()).filter((c) => DEPARTMENT[c]))];
  if (named.length === 1) return named[0];
  return named.includes("beauty") ? "beauty" : "";
}

const rupees = (minor: number) => `Rs ${Math.round(minor / 100).toLocaleString("en-GB")}`;
const hashtag = (s: string) => {
  const t = s.replace(/&/g, "And").replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return t ? `#${t}` : "";
};

/** Products that can be posted: live, with a photo, in stock. */
async function candidates() {
  const rows = await prisma.product.findMany({
    where: { status: "ACTIVE", images: { some: {} } },
    select: {
      id: true,
      title: true,
      priceCents: true,
      compareAtCents: true,
      gender: true,
      trackInventory: true,
      salesCount: true,
      createdAt: true,
      brand: { select: { name: true } },
      images: { orderBy: { position: "asc" }, take: 10, select: { id: true, url: true, alt: true } },
      variants: { where: { isActive: true }, select: { size: true, color: true, stock: true } },
      categories: { select: { category: { select: { name: true } } } },
    },
  });
  return rows
    .map(({ categories, ...p }) => ({
      ...p,
      dept: departmentKey(p.gender, categories.map((c) => c.category.name)),
      images: p.images.filter((i) => i.url.startsWith("/uploads/")),
    }))
    .filter((p) => p.images.length > 0 && (!p.trackInventory || p.variants.length === 0 || p.variants.some((v) => v.stock > 0)));
}
type Product = Awaited<ReturnType<typeof candidates>>[number];

export async function packSummary() {
  await ensureSocialTable();
  const [all, scheduled] = await Promise.all([
    candidates(),
    prisma.$queryRaw<{ productId: string; scheduledFor: Date }[]>`SELECT productId, scheduledFor FROM SocialPost`,
  ]);
  const done = new Set(scheduled.map((s) => s.productId));
  const last = scheduled.reduce<Date | null>((m, s) => (!m || s.scheduledFor > m ? s.scheduledFor : m), null);
  return { ready: all.length, scheduled: all.filter((p) => done.has(p.id)).length, remaining: all.filter((p) => !done.has(p.id)).length, last };
}

/** The day (YYYY-MM-DD) of a moment in Pakistan time. */
const shopDay = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

/** The latest remembered post, if it's still to come. */
export async function lastScheduled() {
  await ensureSocialTable();
  const [row] = await prisma.$queryRaw<{ last: Date | null }[]>`SELECT MAX(scheduledFor) AS last FROM SocialPost`;
  return row?.last && row.last > new Date() ? row.last : null;
}

/**
 * The post slots, at each of `times` (Pakistan time), `days` days' worth: from `start`, or right after the last
 * remembered post. Slots already past are skipped (a scheduler can't post in the past).
 */
function slots(o: PackOptions, after: Date | null) {
  const out: { label: string; at: Date }[] = [];
  const want = o.days * o.times.length;
  const from = after ? shopDay(after) : o.start;
  const [y, m, d] = from.split("-").map(Number);
  const floor = Math.max(Date.now(), after?.getTime() ?? 0);
  for (let day = 0; out.length < want && day <= o.days + 1; day++) {
    const ymd = new Date(Date.UTC(y, m - 1, d + day)).toISOString().slice(0, 10);
    for (const t of o.times) {
      const at = new Date(`${ymd}T${t}:00+05:00`);
      if (at.getTime() > floor && out.length < want) out.push({ label: `${ymd.replace(/-/g, "/")} ${t}`, at });
    }
  }
  return out;
}

/** Round-robin across lists: a1, b1, c1, a2, b2… */
function interleave<T>(lists: T[][]) {
  const out: T[] = [];
  const total = lists.reduce((n, l) => n + l.length, 0);
  for (let i = 0; out.length < total; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

/** By department, keeping the order within each. */
function groupByDepartment(products: Product[]) {
  const groups = new Map<string, Product[]>();
  for (const p of products) groups.set(p.dept, [...(groups.get(p.dept) ?? []), p]);
  return [...groups.values()];
}

function order(products: Product[], o: PackOptions) {
  const pct = (p: Product) => discountPercent(p.priceCents, p.compareAtCents) ?? 0;
  const sorted = [...products].sort((a, b) =>
    o.order === "sale"
      ? pct(b) - pct(a) || b.salesCount - a.salesCount
      : o.order === "popular"
        ? b.salesCount - a.salesCount || +b.createdAt - +a.createdAt
        : +b.createdAt - +a.createdAt,
  );
  // alternate departments (women, men, kids…) so the feed doesn't show ten suits in a row
  return o.mix ? interleave(groupByDepartment(sorted)) : sorted;
}

/**
 * What goes in each post, in posting order. "product": one product per post. "collection": the products of
 * one department in tens (best first), departments taking turns when `mix` is on.
 */
function posts(products: Product[], o: PackOptions): Product[][] {
  if (o.perPost === "product") return order(products, o).map((p) => [p]);
  const sorted = order(products, { ...o, mix: false });
  const groups = groupByDepartment(sorted);
  const chunks = groups.map((g) => {
    const out: Product[][] = [];
    for (let i = 0; i < g.length; i += PER_COLLECTION) out.push(g.slice(i, i + PER_COLLECTION));
    return out;
  });
  // products without a department go last, rather than taking a turn as a short mixed post
  if (o.mix) {
    const known = chunks.filter((_, i) => groups[i][0].dept);
    return [...interleave(known), ...chunks.filter((_, i) => !groups[i][0].dept).flat()];
  }
  // not mixed: the collection with the best first product goes first
  const rank = new Map(sorted.map((p, i) => [p.id, i]));
  return chunks.flat().sort((a, b) => rank.get(a[0].id)! - rank.get(b[0].id)!);
}

/** The caption. Sale prices only on posts during the sale; after it, the regular price. */
function caption(p: Product, at: Date, o: PackOptions) {
  const onSale = !!p.compareAtCents && p.compareAtCents > p.priceCents;
  const inSale = onSale && at < SALE.ends;
  const pct = discountPercent(p.priceCents, p.compareAtCents);
  const sizes = [...new Set(p.variants.filter((v) => v.stock > 0 && v.size).map((v) => v.size!))];
  const colours = [...new Set(p.variants.filter((v) => v.color).map((v) => v.color!))];
  const dept = deptOf(p);

  const lines = [
    p.title,
    p.brand ? `by ${p.brand.name}` : null,
    "",
    inSale
      ? `${SALE.title}: ${rupees(p.priceCents)} (was ${rupees(p.compareAtCents!)}, ${pct}% off) until ${SALE.lastDay}`
      : rupees(onSale ? p.compareAtCents! : p.priceCents),
    sizes.length ? `Sizes: ${sizes.join(", ")}` : null,
    colours.length > 1 ? `Colours: ${colours.join(", ")}` : null,
    "",
    "✔ Cash on delivery · Easypaisa & JazzCash",
    "✔ Free shipping over Rs 15,000 · Easy 14-day returns",
    "",
    `Shop it at ${APP_URL.replace(/^https?:\/\//, "")} 🛍️`,
    "",
    [o.hashtags.trim(), p.brand ? hashtag(p.brand.name) : "", dept?.tag ?? "", inSale ? "#1111Sale" : ""].filter(Boolean).join(" "),
  ];
  return lines.filter((l) => l !== null).join("\n");
}

/** The caption of a collection: a numbered list of the products, in the order of the pictures. */
function collectionCaption(items: Product[], at: Date, o: PackOptions) {
  const inSale = at < SALE.ends && items.some((p) => !!p.compareAtCents && p.compareAtCents > p.priceCents);
  const dept = deptOf(items[0]);
  const price = (p: Product) => {
    const onSale = !!p.compareAtCents && p.compareAtCents > p.priceCents;
    if (onSale && inSale) return `${rupees(p.priceCents)} (was ${rupees(p.compareAtCents!)}, ${discountPercent(p.priceCents, p.compareAtCents)}% off)`;
    return rupees(onSale ? p.compareAtCents! : p.priceCents);
  };
  const brands = [...new Set(items.map((p) => (p.brand ? hashtag(p.brand.name) : "")).filter(Boolean))].slice(0, 5);

  return [
    `${dept?.emoji ?? "🛍️"} ${inSale ? `${SALE.title}: ` : ""}${dept?.picks ?? "Our picks"} (swipe →)`,
    "",
    ...items.map((p, i) => `${i + 1}. ${p.title} · ${price(p)}`),
    "",
    inSale ? `Sale prices until ${SALE.lastDay}.` : null,
    "✔ Cash on delivery · Easypaisa & JazzCash",
    "✔ Free shipping over Rs 15,000 · Easy 14-day returns",
    "",
    `Shop them all at ${APP_URL.replace(/^https?:\/\//, "")} 🛍️`,
    "",
    [o.hashtags.trim(), dept?.tag ?? "", ...brands, inSale ? "#1111Sale" : ""].filter(Boolean).join(" "),
  ]
    .filter((l) => l !== null)
    .join("\n");
}

const HEADER = ["Date", "Text", "Link", "Media URLs", "Title", "Labels", "Alt text(s)", "Comment(s)", "Pin board, FB album, or Google category", "Post subtype", "CTA", "Reminder"];
const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

const picture = (i: { id: string; alt: string | null }, p: Product) => ({
  url: `${APP_URL}/api/social-image/${i.id}.jpg`,
  path: `/api/social-image/${i.id}.jpg`,
  alt: (i.alt || p.title).replace(/\|\|/g, "|"),
});

/** The posts a pack would contain: slot, products, caption, photos and labels. */
async function plan(o: PackOptions) {
  await ensureSocialTable();
  const scheduled = o.includeScheduled
    ? new Set<string>()
    : new Set((await prisma.$queryRaw<{ productId: string }[]>`SELECT productId FROM SocialPost`).map((r) => r.productId));
  const groups = posts((await candidates()).filter((p) => !scheduled.has(p.id)), o);
  const after = o.continueAfterLast ? await lastScheduled() : null;
  return slots(o, after)
    .slice(0, Math.min(MAX_POSTS, Math.max(1, o.maxPosts)))
    .slice(0, groups.length)
    .map((slot, i) => {
      const items = groups[i];
      const single = items.length === 1;
      const p = items[0];
      const photos = single ? p.images.slice(0, Math.max(1, Math.min(10, o.photos))).map((im) => picture(im, p)) : items.map((q) => picture(q.images[0], q));
      const inSale = slot.at < SALE.ends && items.some((q) => !!q.compareAtCents && q.compareAtCents > q.priceCents);
      return {
        slot,
        products: items,
        caption: single ? caption(p, slot.at, o) : collectionCaption(items, slot.at, o),
        photos,
        labels: [deptOf(p)?.label, inSale ? SALE.name : null].filter(Boolean).join(", "),
      };
    });
}

/** The first few posts, for the preview on the admin page. */
export async function previewPack(o: PackOptions, n = 3) {
  return (await plan(o)).slice(0, n);
}

/** Builds the CSV; with `remember`, saves the products as scheduled. */
export async function buildPack(o: PackOptions, remember: boolean) {
  const posts = await plan(o);
  const rows = posts.map((p) => [p.slot.label, p.caption, "", p.photos.map((x) => x.url).join(", "), "", p.labels, p.photos.map((x) => x.alt).join("||"), "", "", "", "", ""]);
  const csv = [HEADER, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

  if (remember && posts.length) {
    await prisma.$executeRaw`INSERT INTO SocialPost (productId, scheduledFor) VALUES ${Prisma.join(
      posts.flatMap(({ slot, products }) => products.map((p) => Prisma.sql`(${p.id}, ${slot.at})`)),
    )} ON DUPLICATE KEY UPDATE scheduledFor = VALUES(scheduledFor)`;
  }
  return {
    csv,
    count: posts.length,
    products: posts.reduce((n, p) => n + p.products.length, 0),
    first: posts[0]?.slot,
    last: posts.at(-1)?.slot,
  };
}

export async function clearScheduled() {
  await ensureSocialTable();
  await prisma.$executeRawUnsafe("DELETE FROM `SocialPost`");
}
