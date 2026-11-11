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
 * Products put in a pack are remembered (SocialPost), so the next pack carries on with the rest.
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
export type Order = "sale" | "newest" | "popular";

export type PackOptions = {
  start: string; // YYYY-MM-DD, Pakistan time
  days: number;
  times: string[]; // HH:MM, Pakistan time
  photos: number; // photos per post (1 = single photo, 2-10 = carousel)
  order: Order;
  mix: boolean; // alternate departments
  hashtags: string;
  includeScheduled: boolean;
};

/** By Product.gender, compared in lower case (stored as "Women", "Men"…). */
const DEPARTMENT: Record<string, { label: string; tag: string }> = {
  women: { label: "Women", tag: "#WomensFashion" },
  men: { label: "Men", tag: "#MensFashion" },
  kids: { label: "Kids", tag: "#KidsFashion" },
  beauty: { label: "Beauty", tag: "#Beauty" },
  jewellery: { label: "Jewellery", tag: "#Jewellery" },
};

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
    },
  });
  return rows
    .map((p) => ({ ...p, images: p.images.filter((i) => i.url.startsWith("/uploads/")) }))
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

/** The post slots: every day from `start`, at each of `times` (Pakistan time). */
function slots(o: PackOptions) {
  const out: { label: string; at: Date }[] = [];
  const [y, m, d] = o.start.split("-").map(Number);
  for (let day = 0; day < o.days; day++) {
    const date = new Date(Date.UTC(y, m - 1, d + day));
    const ymd = date.toISOString().slice(0, 10);
    for (const t of o.times) out.push({ label: `${ymd.replace(/-/g, "/")} ${t}`, at: new Date(`${ymd}T${t}:00+05:00`) });
  }
  return out;
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
  if (!o.mix) return sorted;
  // alternate departments (women, men, kids…) so the feed doesn't show ten suits in a row
  const groups = new Map<string, Product[]>();
  for (const p of sorted) {
    const g = (p.gender ?? "").toLowerCase();
    groups.set(g, [...(groups.get(g) ?? []), p]);
  }
  const lists = [...groups.values()];
  const out: Product[] = [];
  for (let i = 0; out.length < sorted.length; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

/** The caption. Sale prices only on posts during the sale; after it, the regular price. */
function caption(p: Product, at: Date, o: PackOptions) {
  const onSale = !!p.compareAtCents && p.compareAtCents > p.priceCents;
  const inSale = onSale && at < SALE.ends;
  const pct = discountPercent(p.priceCents, p.compareAtCents);
  const sizes = [...new Set(p.variants.filter((v) => v.stock > 0 && v.size).map((v) => v.size!))];
  const colours = [...new Set(p.variants.filter((v) => v.color).map((v) => v.color!))];
  const dept = p.gender ? DEPARTMENT[p.gender.toLowerCase()] : undefined;

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

const HEADER = ["Date", "Text", "Link", "Media URLs", "Title", "Labels", "Alt text(s)", "Comment(s)", "Pin board, FB album, or Google category", "Post subtype", "CTA", "Reminder"];
const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** The posts a pack would contain: slot, product, caption, photos and labels. */
async function plan(o: PackOptions) {
  await ensureSocialTable();
  const scheduled = o.includeScheduled
    ? new Set<string>()
    : new Set((await prisma.$queryRaw<{ productId: string }[]>`SELECT productId FROM SocialPost`).map((r) => r.productId));
  const products = order((await candidates()).filter((p) => !scheduled.has(p.id)), o);
  return slots(o)
    .slice(0, MAX_POSTS)
    .slice(0, products.length)
    .map((slot, i) => {
      const p = products[i];
      const photos = p.images.slice(0, Math.max(1, Math.min(10, o.photos)));
      const labels = [p.gender ? DEPARTMENT[p.gender.toLowerCase()]?.label : null, p.compareAtCents && slot.at < SALE.ends ? SALE.name : null].filter(Boolean).join(", ");
      return {
        slot,
        product: p,
        caption: caption(p, slot.at, o),
        photos: photos.map((i) => ({ url: `${APP_URL}/api/social-image/${i.id}.jpg`, path: `/api/social-image/${i.id}.jpg`, alt: (i.alt || p.title).replace(/\|\|/g, "|") })),
        labels,
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
      posts.map(({ slot, product }) => Prisma.sql`(${product.id}, ${slot.at})`),
    )} ON DUPLICATE KEY UPDATE scheduledFor = VALUES(scheduledFor)`;
  }
  return { csv, count: posts.length, first: posts[0]?.slot.label, last: posts.at(-1)?.slot.label };
}

export async function clearScheduled() {
  await ensureSocialTable();
  await prisma.$executeRawUnsafe("DELETE FROM `SocialPost`");
}
