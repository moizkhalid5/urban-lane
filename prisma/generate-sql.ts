/**
 * Generates a single, self-contained SQL file (db-bundle.sql) that prepares the
 * whole database in one phpMyAdmin → Import — no terminal/Prisma needed on the
 * host. It contains:
 *   - the schema (the committed init migration, MariaDB/MySQL-safe)
 *   - reference data: currencies, site settings, banners, the full category tree,
 *     brands, an admin user, and a demo coupon
 *   - the real product catalogue from prisma/import-data.json (products,
 *     variants, images, category links) — mirroring prisma/import-products.ts
 *
 * Re-runnable: it DROPs every table first, so importing twice is safe.
 *
 * Run:  npx tsx prisma/generate-sql.ts   (or: npm run db:sqlfile)
 * Admin login is baked from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (defaults
 * admin@urbanlane.com / ChangeMe123!).
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import bcrypt from "bcryptjs";
import { CATEGORY_TREE, BRANDS, FEATURED_BRANDS, CURRENCIES, type CategoryNode } from "./data/catalog-data";
import { childSlug, slugify } from "../src/lib/slug";

const NOW = "2026-06-27 12:00:00.000";
const rs = (rupees: number) => Math.round(rupees) * 100; // PKR -> paisa

// ── helpers ──────────────────────────────────────────────────────────────
let idCounter = 0;
function genId(prefix = "c"): string {
  idCounter += 1;
  // cuid-like, stable within a run, unique, < 191 chars.
  const n = idCounter.toString(36).padStart(6, "0");
  const r = (idCounter * 2654435761 % 0xffffffff).toString(36);
  return `${prefix}${n}${r}`.slice(0, 25);
}

/** MySQL-escape a value into a SQL literal. */
function sql(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  const escaped = v
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\x00/g, "")
    .replace(/\x1a/g, "\\Z");
  return `'${escaped}'`;
}

function insert(table: string, row: Record<string, string | number | boolean | null | undefined>): string {
  const cols = Object.keys(row);
  const vals = cols.map((c) => sql(row[c]));
  return `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES (${vals.join(", ")});`;
}

type ImportProduct = {
  sku: string;
  title: string;
  description: string | null;
  brand: string;
  category: string;
  priceCents: number;
  variants: { size: string | null; color: string | null; stock: number }[];
  images: string[];
};

const TABLES = [
  "AuditLog", "RefundRequest", "ContactMessage", "NewsletterSubscriber", "Banner",
  "Currency", "SiteSettings", "Coupon", "WishlistItem", "OrderItem", "Order",
  "CartItem", "Cart", "ProductImage", "ProductVariant", "ProductCategory",
  "Product", "Brand", "Category", "Token", "Address", "CustomerProfile", "User",
];

function main() {
  const out: string[] = [];
  out.push("-- Urban Lane — full database bundle (schema + data)");
  out.push("-- Import via phpMyAdmin → Import. Safe to re-run (drops tables first).");
  out.push("SET NAMES utf8mb4;");
  out.push("SET FOREIGN_KEY_CHECKS = 0;");
  out.push("");

  // 1) Drop existing tables so a re-import never errors.
  out.push("-- ─── Drop existing tables ───");
  for (const t of TABLES) out.push(`DROP TABLE IF EXISTS \`${t}\`;`);
  out.push("");

  // 2) Schema (the committed Prisma migration — already utf8mb4_unicode_ci).
  out.push("-- ─── Schema ───");
  const ddl = readFileSync(join(process.cwd(), "prisma", "migrations", "20260625125239_init", "migration.sql"), "utf-8");
  out.push(ddl.trim());
  out.push("");

  // 3) Currencies
  out.push("-- ─── Currencies ───");
  for (const c of CURRENCIES) {
    out.push(insert("Currency", {
      code: c.code, symbol: c.symbol, flag: c.flag, rate: c.rate,
      roundWhole: true, isBase: c.isBase, isEnabled: true, position: c.position,
    }));
  }
  out.push("");

  // 4) Site settings
  out.push("-- ─── Site settings ───");
  out.push(insert("SiteSettings", {
    id: "singleton",
    storeName: "Urban Lane",
    storeEmail: process.env.STORE_NOTIFICATIONS_EMAIL || "orders@urbanlane.com",
    baseCurrency: "PKR",
    codLimitCents: rs(10000),
    freeShippingThresholdCents: rs(15000),
    flatShippingCents: rs(300),
    bankTransferInstructions:
      "Transfer the total to: Urban Lane, Bank XYZ, Account 0000-0000-0000. Use your order number as the reference, then email the receipt to orders@urbanlane.com.",
    announcementText: "Free shipping on orders over Rs 15,000 · Easy 14-day returns",
    updatedAt: NOW,
  }));
  out.push("");

  // 5) Banners (homepage hero / promo)
  out.push("-- ─── Banners ───");
  const banners = [
    { kind: "HERO", title: "The New Season", subtitle: "Premium essentials for every day", image: "https://picsum.photos/seed/ul-hero-1/1920/900", link: "/collections/women", position: 0 },
    { kind: "HERO", title: "Menswear Edit", subtitle: "Tailored, relaxed, refined", image: "https://picsum.photos/seed/ul-hero-2/1920/900", link: "/collections/men", position: 1 },
    { kind: "PROMO", title: "Outlet — up to 40% off", subtitle: "Limited stock", image: "https://picsum.photos/seed/ul-promo-1/1200/600", link: "/collections/outlet", position: 0 },
  ];
  for (const b of banners) {
    out.push(insert("Banner", { id: genId(), kind: b.kind, title: b.title, subtitle: b.subtitle, image: b.image, link: b.link, position: b.position, isActive: true, createdAt: NOW, updatedAt: NOW }));
  }
  out.push("");

  // 6) Categories (full tree, mirroring seed.ts walk)
  out.push("-- ─── Categories ───");
  const slugToId = new Map<string, string>();
  function walk(node: CategoryNode, parentId: string | null, parentSlug: string | null, level: number, position: number) {
    const slug = childSlug(parentSlug, node.name);
    const id = genId();
    slugToId.set(slug, id);
    out.push(insert("Category", {
      id, name: node.name, slug, parentId, level, position,
      isVirtual: node.isVirtual ?? false, showInNav: true, isActive: true, createdAt: NOW, updatedAt: NOW,
    }));
    const children = node.children ?? [];
    for (let i = 0; i < children.length; i++) walk(children[i], id, slug, level + 1, i);
  }
  for (let i = 0; i < CATEGORY_TREE.length; i++) walk(CATEGORY_TREE[i], null, null, 0, i);
  out.push("");

  // 7) Brands (seed list + any extra brands referenced by the catalogue)
  const data: ImportProduct[] = JSON.parse(readFileSync(join(process.cwd(), "prisma", "import-data.json"), "utf-8"));
  out.push("-- ─── Brands ───");
  const brandIdByName = new Map<string, string>();
  let brandPos = 0;
  for (const name of BRANDS) {
    const id = genId();
    const featured = FEATURED_BRANDS.includes(name);
    brandIdByName.set(name, id);
    out.push(insert("Brand", {
      id, name, slug: slugify(name), isFeatured: featured, position: brandPos++,
      banner: featured ? `https://picsum.photos/seed/brand-${slugify(name)}/1200/400` : null,
      createdAt: NOW, updatedAt: NOW,
    }));
  }
  for (const name of [...new Set(data.map((d) => d.brand))]) {
    if (brandIdByName.has(name)) continue;
    const id = genId();
    brandIdByName.set(name, id);
    out.push(insert("Brand", { id, name, slug: slugify(name), isFeatured: false, position: brandPos++, banner: null, createdAt: NOW, updatedAt: NOW }));
  }
  out.push("");

  // 8) Admin user
  out.push("-- ─── Admin user ───");
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@urbanlane.com";
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  out.push(insert("User", {
    id: genId(), email: adminEmail, name: process.env.SEED_ADMIN_NAME || "Store Admin",
    passwordHash: bcrypt.hashSync(adminPass, 12), role: "ADMIN", emailVerified: NOW,
    isActive: true, createdAt: NOW, updatedAt: NOW,
  }));
  out.push("");

  // 9) Demo coupon
  out.push("-- ─── Coupon ───");
  out.push(insert("Coupon", { id: genId(), code: "WELCOME10", description: "10% off your first order", type: "PERCENTAGE", value: 10, isActive: true, createdAt: NOW, updatedAt: NOW }));
  out.push("");

  // 10) Products + variants + images + category links (mirrors import-products.ts)
  out.push("-- ─── Products ───");
  const missingCats = new Set<string>();
  let productCount = 0, variantCount = 0, imageCount = 0;
  for (const p of data) {
    const categoryId = slugToId.get(p.category);
    if (!categoryId) { missingCats.add(p.category); continue; }
    const brandId = brandIdByName.get(p.brand) ?? null;
    const slug = `${slugify(p.title)}-${slugify(p.sku)}`.slice(0, 90);
    const gender = p.category === "men" ? "Men" : p.category === "women" ? "Women" : p.category === "kids" ? "Kids" : null;
    const productId = genId();

    out.push(insert("Product", {
      id: productId, title: p.title, slug, description: p.description, status: "ACTIVE",
      brandId, gender, priceCents: p.priceCents, sku: p.sku, publishedAt: NOW,
      salesCount: 0, createdAt: NOW, updatedAt: NOW,
    }));
    out.push(insert("ProductCategory", { productId, categoryId }));

    p.images.forEach((url, i) => {
      out.push(insert("ProductImage", { id: genId(), productId, url, alt: p.title, position: i, createdAt: NOW }));
      imageCount++;
    });

    const variants = p.variants.length ? p.variants : [{ size: null, color: null, stock: 0 }];
    variants.forEach((v, i) => {
      const label = [v.size, v.color].filter(Boolean).join(" / ") || null;
      out.push(insert("ProductVariant", { id: genId(), productId, label, size: v.size, color: v.color, stock: v.stock, position: i, isActive: true, createdAt: NOW, updatedAt: NOW }));
      variantCount++;
    });
    productCount++;
  }
  out.push("");
  out.push("SET FOREIGN_KEY_CHECKS = 1;");
  out.push("");

  const file = join(process.cwd(), "db-bundle.sql");
  writeFileSync(file, out.join("\n"), "utf-8");

  console.log(`✅ Wrote ${file}`);
  console.log(`   ${productCount} products, ${variantCount} variants, ${imageCount} images`);
  console.log(`   ${slugToId.size} categories, ${brandIdByName.size} brands, ${CURRENCIES.length} currencies`);
  console.log(`   Admin: ${adminEmail} / ${adminPass}`);
  if (missingCats.size) console.warn(`   ⚠ skipped products with unknown categories: ${[...missingCats].join(", ")}`);
}

main();
