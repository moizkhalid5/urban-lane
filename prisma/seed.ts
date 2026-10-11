/**
 * Seed script — reference data (categories, brands, currencies, settings) plus
 * demo content (products, variants, images, an admin user, a demo customer, and
 * demo orders). Idempotent: it clears and rebuilds the demo data on each run.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATEGORY_TREE, BRANDS, FEATURED_BRANDS, CURRENCIES, type CategoryNode } from "./data/catalog-data";
import { childSlug, slugify } from "../src/lib/slug";

const prisma = new PrismaClient();

const rs = (rupees: number) => Math.round(rupees) * 100; // PKR -> paisa (minor units)

// ──────────────────────────────────────────────────────────────────────────
// Categories
// ──────────────────────────────────────────────────────────────────────────

// Homepage "Shop by category" tile photos (public/images/categories), by top-level slug.
const CATEGORY_TILE_IMAGES: Record<string, string> = {
  women: "/images/categories/women.jpg",
  men: "/images/categories/men.jpg",
  kids: "/images/categories/kids.jpg",
  beauty: "/images/categories/beauty.jpg",
  jewellery: "/images/categories/jewellery.jpg",
};

async function seedCategories(): Promise<Map<string, string>> {
  const slugToId = new Map<string, string>();

  async function walk(node: CategoryNode, parentId: string | null, parentSlug: string | null, level: number, position: number) {
    const slug = childSlug(parentSlug, node.name);
    const created = await prisma.category.create({
      data: {
        name: node.name,
        slug,
        parentId,
        level,
        position,
        isVirtual: node.isVirtual ?? false,
        showInNav: true,
        image: level === 0 ? (CATEGORY_TILE_IMAGES[slug] ?? null) : null,
      },
    });
    slugToId.set(slug, created.id);
    const children = node.children ?? [];
    for (let i = 0; i < children.length; i++) {
      await walk(children[i], created.id, slug, level + 1, i);
    }
  }

  for (let i = 0; i < CATEGORY_TREE.length; i++) {
    await walk(CATEGORY_TREE[i], null, null, 0, i);
  }
  console.log(`  ✓ ${slugToId.size} categories`);
  return slugToId;
}

// ──────────────────────────────────────────────────────────────────────────
// Brands
// ──────────────────────────────────────────────────────────────────────────

async function seedBrands(): Promise<Map<string, string>> {
  const nameToId = new Map<string, string>();
  const names = [...new Set([...BRANDS, ...FEATURED_BRANDS])];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const featured = FEATURED_BRANDS.indexOf(name);
    const b = await prisma.brand.create({
      data: {
        name,
        slug: slugify(name),
        isFeatured: featured >= 0,
        position: featured >= 0 ? featured : FEATURED_BRANDS.length + i,
        banner: featured >= 0 ? `/images/brands/${slugify(name)}.jpg` : null,
      },
    });
    nameToId.set(name, b.id);
  }
  console.log(`  ✓ ${nameToId.size} brands`);
  return nameToId;
}

// ──────────────────────────────────────────────────────────────────────────
// Products
// ──────────────────────────────────────────────────────────────────────────

type ProductSpec = {
  title: string;
  gender: string;
  categorySlug: string;
  brand: string;
  price: number; // rupees
  compareAt?: number; // rupees (sale)
  sizes?: string[];
  colors?: { name: string; hex: string }[];
  featured?: boolean;
  outlet?: boolean;
  productType?: string;
  material?: string;
};

const APPAREL_SIZES = ["XS", "S", "M", "L", "XL"];
const NUM_SIZES = ["6", "8", "10", "12", "14"];
const KID_SIZES = ["2-3Y", "3-4Y", "5-6Y", "7-8Y"];
const COLORS = {
  black: { name: "Black", hex: "#111111" },
  white: { name: "White", hex: "#ffffff" },
  navy: { name: "Navy", hex: "#1f2a44" },
  beige: { name: "Beige", hex: "#d9cbb3" },
  grey: { name: "Grey", hex: "#9aa0a6" },
  burgundy: { name: "Burgundy", hex: "#6b1f2b" },
  olive: { name: "Olive", hex: "#5b6236" },
  pink: { name: "Pink", hex: "#e8b4c0" },
};
const c = (...keys: (keyof typeof COLORS)[]) => keys.map((k) => COLORS[k]);

const PRODUCTS: ProductSpec[] = [
  // ── Women ──
  { title: "Tiered Maxi Dress", gender: "women", categorySlug: "women-dresses-maxi-dress", brand: "Zara", price: 6499, compareAt: 8999, sizes: NUM_SIZES, colors: c("black", "burgundy", "beige"), featured: true, outlet: true, productType: "Dress", material: "Viscose" },
  { title: "Wrap Midi Dress", gender: "women", categorySlug: "women-dresses-midi-dress", brand: "New Look", price: 5499, sizes: NUM_SIZES, colors: c("navy", "black"), featured: true, productType: "Dress" },
  { title: "High-Rise Skinny Jeans", gender: "women", categorySlug: "women-trousers-jeans", brand: "H&M", price: 4299, sizes: NUM_SIZES, colors: c("navy", "black"), productType: "Jeans", material: "Cotton blend" },
  { title: "Seamless Leggings", gender: "women", categorySlug: "women-trousers-leggings", brand: "Adidas", price: 3499, sizes: APPAREL_SIZES, colors: c("black", "olive"), productType: "Leggings" },
  { title: "Padded T-Shirt Bra", gender: "women", categorySlug: "women-lingerie-bras-padded", brand: "M&S", price: 2599, sizes: ["32B", "34B", "34C", "36C"], colors: c("black", "beige") },
  { title: "Cotton Brief 5-Pack", gender: "women", categorySlug: "women-lingerie-knickers-briefs", brand: "M&S", price: 1999, colors: c("black"), productType: "Knickers" },
  { title: "Cuffed Jogger", gender: "women", categorySlug: "women-loungewear-joggers", brand: "GAP", price: 3999, sizes: APPAREL_SIZES, colors: c("grey", "black", "pink"), outlet: true, compareAt: 4999 },
  { title: "Satin Slip Dress", gender: "women", categorySlug: "women-nightwear-slips", brand: "Esprit", price: 2999, sizes: APPAREL_SIZES, colors: c("burgundy", "black") },
  { title: "Longline Wool Coat", gender: "women", categorySlug: "women-coats-and-jackets", brand: "Crew Clothing", price: 12999, sizes: APPAREL_SIZES, colors: c("beige", "navy"), featured: true, material: "Wool blend" },
  { title: "Performance Tank Top", gender: "women", categorySlug: "women-activewear-tops", brand: "Adidas", price: 2499, sizes: APPAREL_SIZES, colors: c("white", "black") },
  { title: "Quilted Shoulder Bag", gender: "women", categorySlug: "women-accessories-bags-and-purses", brand: "River Island", price: 5999, colors: c("black", "beige"), featured: true, productType: "Bag" },
  { title: "Oversized Sunglasses", gender: "women", categorySlug: "women-accessories-sunglasses", brand: "River Island", price: 1799, outlet: true, compareAt: 2499 },

  // ── Men ──
  { title: "Slim Fit Formal Shirt", gender: "men", categorySlug: "men-tops-shirts-formal", brand: "Burton", price: 3999, sizes: APPAREL_SIZES, colors: c("white", "navy"), featured: true, productType: "Shirt", material: "Cotton" },
  { title: "Pima Cotton T-Shirt", gender: "men", categorySlug: "men-tops-t-shirts", brand: "Ralph Lauren", price: 3499, sizes: APPAREL_SIZES, colors: c("white", "navy", "olive"), featured: true },
  { title: "Pullover Hoodie", gender: "men", categorySlug: "men-tops-hoodies", brand: "Hollister", price: 4999, compareAt: 6499, sizes: APPAREL_SIZES, colors: c("grey", "black"), outlet: true },
  { title: "Stretch Chinos", gender: "men", categorySlug: "men-trousers-chinos", brand: "GAP", price: 4499, sizes: NUM_SIZES, colors: c("beige", "navy", "olive"), productType: "Chinos" },
  { title: "Tapered Jeans", gender: "men", categorySlug: "men-trousers-jeans", brand: "Lee Cooper", price: 4999, sizes: NUM_SIZES, colors: c("navy", "black"), productType: "Jeans" },
  { title: "Boxer Brief 3-Pack", gender: "men", categorySlug: "men-underwear-boxers", brand: "Next", price: 2299, sizes: APPAREL_SIZES, colors: c("black") },
  { title: "Two-Piece Suit Jacket", gender: "men", categorySlug: "men-suits-jackets", brand: "Debenhams", price: 14999, sizes: ["38R", "40R", "42R"], colors: c("navy", "black"), featured: true, material: "Wool blend" },
  { title: "Combed Cotton Socks 5-Pack", gender: "men", categorySlug: "men-accessories-socks", brand: "Next", price: 1499, colors: c("black", "grey") },
  { title: "Leather Bifold Wallet", gender: "men", categorySlug: "men-accessories-wallets", brand: "Lacoste", price: 3299, colors: c("black"), outlet: true, compareAt: 3999 },

  // ── Kids ──
  { title: "Boys Graphic Tee", gender: "kids", categorySlug: "kids-boys-2-8-yrs-tops", brand: "Tu Clothing", price: 999, sizes: KID_SIZES, colors: c("white", "navy"), featured: true },
  { title: "Girls 2-Piece Set", gender: "kids", categorySlug: "kids-girls-2-8-yrs-sets", brand: "Next", price: 1999, sizes: KID_SIZES, colors: c("pink", "grey") },
  { title: "Baby Boys Bodysuit", gender: "kids", categorySlug: "kids-baby-boys-0-24m-tops", brand: "GAP", price: 799, sizes: ["0-3M", "3-6M", "6-12M"], colors: c("white", "navy") },

  // ── Beauty (single-variant — tests no forced selection) ──
  { title: "Matte Liquid Lipstick", gender: "beauty", categorySlug: "beauty-lips", brand: "MAC", price: 2299, featured: true, productType: "Lipstick" },
  { title: "Fit Me Foundation", gender: "beauty", categorySlug: "beauty-face", brand: "Maybelline", price: 1899, productType: "Foundation" },
  { title: "All Nighter Setting Spray", gender: "beauty", categorySlug: "beauty-makeup", brand: "Urban Decay", price: 2999, outlet: true, compareAt: 3499 },
  { title: "Eau de Parfum 50ml", gender: "beauty", categorySlug: "beauty-fragrances", brand: "Esprit", price: 5999, featured: true, productType: "Fragrance" },

  // ── Jewellery ──
  { title: "Layered Pendant Necklace", gender: "jewellery", categorySlug: "jewellery-necklaces", brand: "River Island", price: 2499, colors: c("beige"), featured: true, productType: "Necklace", material: "Gold-plated" },
  { title: "Pavé Hoop Earrings", gender: "jewellery", categorySlug: "jewellery-earrings", brand: "New Look", price: 1799, outlet: true, compareAt: 2299 },
  { title: "Beaded Stretch Bracelet", gender: "jewellery", categorySlug: "jewellery-bracelets", brand: "River Island", price: 1299, productType: "Bracelet" },
];

function buildVariants(spec: ProductSpec): Prisma.ProductVariantCreateWithoutProductInput[] {
  const sizes = spec.sizes ?? [null];
  const colors = spec.colors ?? [null];
  const totalVariants = sizes.length * colors.length;
  const variants: Prisma.ProductVariantCreateWithoutProductInput[] = [];
  let pos = 0;
  for (const size of sizes) {
    for (const color of colors) {
      const labelParts = [size, color?.name].filter(Boolean);
      // Vary stock to exercise out-of-stock + low-stock states — but only zero out
      // the first variant when the product has more than one (never sell-out a
      // single-variant product).
      const stock = pos === 0 && spec.outlet && totalVariants > 1 ? 0 : 4 + ((pos * 7) % 18);
      variants.push({
        label: labelParts.join(" / ") || null,
        size: size ?? null,
        color: color?.name ?? null,
        colorHex: color?.hex ?? null,
        sku: `${slugify(spec.title).slice(0, 18)}-${pos}`.toUpperCase(),
        stock,
        position: pos,
      });
      pos++;
    }
  }
  return variants;
}

async function seedProducts(catMap: Map<string, string>, brandMap: Map<string, string>) {
  let count = 0;
  for (const spec of PRODUCTS) {
    const categoryId = catMap.get(spec.categorySlug);
    if (!categoryId) {
      console.warn(`  ! missing category ${spec.categorySlug} for "${spec.title}"`);
      continue;
    }
    const brandId = brandMap.get(spec.brand) ?? null;
    const slug = slugify(spec.title);
    const variants = buildVariants(spec);

    await prisma.product.create({
      data: {
        title: spec.title,
        slug,
        description: `${spec.title} by ${spec.brand}. A premium ${spec.productType?.toLowerCase() ?? "piece"} crafted for everyday wear, combining comfort with a clean, modern silhouette.`,
        details: ["Premium materials", "Designed for a flattering fit", "Easy care", spec.material ? `Material: ${spec.material}` : ""].filter(Boolean).join("\n"),
        material: spec.material ?? null,
        status: "ACTIVE",
        brandId,
        gender: spec.gender,
        productType: spec.productType ?? null,
        priceCents: rs(spec.price),
        compareAtCents: spec.compareAt ? rs(spec.compareAt) : null,
        costCents: rs(Math.round(spec.price * 0.55)),
        isFeatured: spec.featured ?? false,
        isOutlet: spec.outlet ?? false,
        tags: [spec.gender, spec.brand, spec.productType ?? ""].filter(Boolean),
        publishedAt: new Date(),
        salesCount: (count * 13) % 50,
        seoTitle: `${spec.title} | ${spec.brand} | Urban Lane`,
        seoDescription: `Shop the ${spec.title} from ${spec.brand} at Urban Lane. Premium fashion with fast delivery.`,
        categories: { create: [{ categoryId }] },
        images: {
          create: [
            { url: `https://picsum.photos/seed/${slug}-1/800/1000`, alt: spec.title, position: 0 },
            { url: `https://picsum.photos/seed/${slug}-2/800/1000`, alt: spec.title, position: 1 },
            { url: `https://picsum.photos/seed/${slug}-3/800/1000`, alt: spec.title, position: 2 },
          ],
        },
        variants: { create: variants },
      },
    });
    count++;
  }
  console.log(`  ✓ ${count} products`);
}

// ──────────────────────────────────────────────────────────────────────────
// Users + demo orders
// ──────────────────────────────────────────────────────────────────────────

async function seedUsers() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@urbanelane.com";
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const adminHash = await bcrypt.hash(adminPass, 12);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      name: process.env.SEED_ADMIN_NAME || "Store Admin",
      passwordHash: adminHash,
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: "customer@example.com",
      name: "Ayesha Khan",
      passwordHash: await bcrypt.hash("Customer123!", 12),
      role: "CUSTOMER",
      emailVerified: new Date(),
      profile: { create: { phone: "+92 300 1234567", acceptsMarketing: true } },
      addresses: {
        create: [
          {
            type: "SHIPPING",
            isDefault: true,
            firstName: "Ayesha",
            lastName: "Khan",
            phone: "+92 300 1234567",
            line1: "12 Gulberg Avenue",
            city: "Lahore",
            state: "Punjab",
            postalCode: "54000",
            country: "PK",
          },
        ],
      },
    },
  });

  console.log(`  ✓ admin (${adminEmail}) + demo customer`);
  return { admin, customer };
}

async function seedDemoOrders(customerId: string) {
  const products = await prisma.product.findMany({
    take: 6,
    include: { variants: { take: 1 }, images: { take: 1 }, brand: true },
  });

  const statuses: { pay: "PAID" | "PENDING"; ful: "DELIVERED" | "PROCESSING" | "SHIPPED" | "UNFULFILLED"; method: "COD" | "BANK_TRANSFER" }[] = [
    { pay: "PAID", ful: "DELIVERED", method: "BANK_TRANSFER" },
    { pay: "PAID", ful: "SHIPPED", method: "BANK_TRANSFER" },
    { pay: "PENDING", ful: "PROCESSING", method: "COD" },
    { pay: "PENDING", ful: "UNFULFILLED", method: "COD" },
  ];

  for (let i = 0; i < statuses.length; i++) {
    const p = products[i % products.length];
    const v = p.variants[0];
    if (!v) continue;
    const unit = v.priceCents ?? p.priceCents;
    const qty = 1 + (i % 2);
    const subtotal = unit * qty;
    const shipping = subtotal >= 1500000 ? 0 : 30000;
    const s = statuses[i];

    await prisma.order.create({
      data: {
        orderNumber: `UL-${(1001 + i).toString()}`,
        userId: customerId,
        email: "customer@example.com",
        phone: "+92 300 1234567",
        firstName: "Ayesha",
        lastName: "Khan",
        shipLine1: "12 Gulberg Avenue",
        shipCity: "Lahore",
        shipState: "Punjab",
        shipPostalCode: "54000",
        shipCountry: "PK",
        currency: "PKR",
        subtotalCents: subtotal,
        shippingCents: shipping,
        totalCents: subtotal + shipping,
        shippingMethod: "standard",
        paymentMethod: s.method,
        paymentStatus: s.pay,
        fulfillmentStatus: s.ful,
        trackingNumber: s.ful === "SHIPPED" || s.ful === "DELIVERED" ? `TRK${100000 + i}` : null,
        items: {
          create: [
            {
              productId: p.id,
              variantId: v.id,
              productTitle: p.title,
              variantLabel: v.label,
              sku: v.sku,
              brandName: p.brand?.name ?? null,
              image: p.images[0]?.url ?? null,
              unitPriceCents: unit,
              quantity: qty,
            },
          ],
        },
      },
    });
  }
  console.log(`  ✓ ${statuses.length} demo orders`);
}

// ──────────────────────────────────────────────────────────────────────────
// Reference data
// ──────────────────────────────────────────────────────────────────────────

async function seedCurrencies() {
  for (const cur of CURRENCIES) {
    await prisma.currency.create({
      data: { ...cur, roundWhole: true, isEnabled: true },
    });
  }
  console.log(`  ✓ ${CURRENCIES.length} currencies`);
}

async function seedSettings() {
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      storeName: "Urban Lane",
      storeEmail: process.env.STORE_NOTIFICATIONS_EMAIL || "orders@urbanelane.com",
      baseCurrency: "PKR",
      codLimitCents: rs(10000), // issues doc: COD limit Rs 10,000
      freeShippingThresholdCents: rs(15000),
      flatShippingCents: rs(300),
      bankTransferInstructions:
        "Transfer the total to: Urban Lane, Bank XYZ, Account 0000-0000-0000. Use your order number as the reference, then email the receipt to orders@urbanelane.com.",
      // One message per line; the black strip rotates through them every 10 seconds.
      announcementText:
        "Free shipping on orders over Rs 15,000\nEasy 14-day returns\nCash on delivery & bank transfer available\nFollow us on Instagram @urbanlane.london",
    },
  });

  // Artwork banners: the text is part of the image, so title is null (shown uncropped, no overlay)
  // and subtitle is the image's alt text. Files live in public/images/banners.
  const banners: { kind: "HERO" | "BRAND_SLIDER" | "PAYMENT" | "PROMO"; title: string | null; subtitle?: string; image: string; link: string; position: number }[] = [
    { kind: "HERO", title: null, subtitle: "Urban Lane online sale on womenswear", image: "/images/banners/women-2x1.jpg", link: "/collections/women", position: 0 },
    { kind: "HERO", title: null, subtitle: "Styles and fit: short-sleeve party wear shirts for men", image: "/images/banners/men-2x1.jpg", link: "/collections/men", position: 1 },
    { kind: "HERO", title: null, subtitle: "Summer kids collection", image: "/images/banners/kids-2x1.jpg", link: "/collections/kids", position: 2 },
    { kind: "HERO", title: null, subtitle: "New season: 30% off, limited time offer", image: "/images/banners/sale-2x1.jpg", link: "/collections/outlet", position: 3 },
    { kind: "PROMO", title: null, subtitle: "Winter collection: modern style for a colder world", image: "/images/banners/winter.jpg", link: "/collections/men", position: 0 },
  ];
  for (const b of banners) await prisma.banner.create({ data: { ...b, isActive: true } });
  console.log(`  ✓ site settings + ${banners.length} banners`);
}

// ──────────────────────────────────────────────────────────────────────────

async function clear() {
  // Order matters (FK constraints). Cascades cover most children.
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.refundRequest.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.currency.deleteMany();
  await prisma.contactMessage.deleteMany();
  await prisma.newsletterSubscriber.deleteMany();
  await prisma.token.deleteMany();
  await prisma.address.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log("🌱 Seeding Urban Lane…");
  await clear();
  const catMap = await seedCategories();
  const brandMap = await seedBrands();
  await seedCurrencies();
  await seedSettings();
  await seedProducts(catMap, brandMap);
  const { customer } = await seedUsers();
  await seedDemoOrders(customer.id);

  // A demo coupon
  await prisma.coupon.create({
    data: { code: "WELCOME10", description: "10% off your first order", type: "PERCENTAGE", value: 10, isActive: true },
  });
  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
