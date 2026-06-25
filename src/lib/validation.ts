import { z } from "zod";

// ──────────────────────────────────────────────────────────────────────────
// Auth
// ──────────────────────────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter your name").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100)
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[0-9]/, "Include a number"),
    acceptsMarketing: z.boolean().optional().default(false),
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[0-9]/, "Include a number"),
});

// ──────────────────────────────────────────────────────────────────────────
// Address & checkout
// ──────────────────────────────────────────────────────────────────────────

export const addressSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  line1: z.string().trim().min(3).max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  postalCode: z.string().trim().min(2).max(20),
  country: z.string().trim().min(2).max(2).default("PK"),
  type: z.enum(["SHIPPING", "BILLING"]).default("SHIPPING"),
  isDefault: z.boolean().optional().default(false),
});

export const checkoutSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: z.string().trim().min(5).max(30),
  country: z.string().trim().min(2).max(2),
  line1: z.string().trim().min(3).max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  postalCode: z.string().trim().min(2).max(20),
  shippingMethod: z.string().trim().min(1).default("standard"),
  paymentMethod: z.enum(["COD", "BANK_TRANSFER", "CARD", "STRIPE", "PAYPAL", "SAFEPAY", "PAYFAST"]),
  couponCode: z.string().trim().max(40).optional().or(z.literal("")),
  customerNote: z.string().trim().max(1000).optional().or(z.literal("")),
});

// ──────────────────────────────────────────────────────────────────────────
// Cart
// ──────────────────────────────────────────────────────────────────────────

export const cartAddSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(99).default(1),
});

export const cartUpdateSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(0).max(99),
});

// ──────────────────────────────────────────────────────────────────────────
// Storefront forms
// ──────────────────────────────────────────────────────────────────────────

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  subject: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(3000),
});

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const refundSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  orderNumber: z.string().trim().max(40).optional().or(z.literal("")),
  subject: z.string().trim().min(2).max(120),
  reason: z.string().trim().min(10).max(3000),
  attachment: z.string().url().optional().or(z.literal("")),
});

// ──────────────────────────────────────────────────────────────────────────
// Admin: products, variants, categories, brands, coupons, settings
// ──────────────────────────────────────────────────────────────────────────

const moneyMinor = z.number().int().min(0);

export const variantInputSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().max(80).optional().or(z.literal("")),
  size: z.string().trim().max(40).optional().or(z.literal("")),
  color: z.string().trim().max(40).optional().or(z.literal("")),
  colorHex: z.string().trim().max(9).optional().or(z.literal("")),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  priceCents: moneyMinor.optional().nullable(),
  stock: z.number().int().min(0).default(0),
  image: z.string().trim().optional().or(z.literal("")),
});

export const productInputSchema = z.object({
  title: z.string().trim().min(2).max(180),
  slug: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(8000).optional().or(z.literal("")),
  details: z.string().trim().max(4000).optional().or(z.literal("")),
  material: z.string().trim().max(120).optional().or(z.literal("")),
  condition: z.string().trim().max(60).optional().or(z.literal("")),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  brandId: z.string().optional().nullable(),
  gender: z.string().trim().max(40).optional().or(z.literal("")),
  productType: z.string().trim().max(80).optional().or(z.literal("")),
  priceCents: moneyMinor,
  compareAtCents: moneyMinor.optional().nullable(),
  costCents: moneyMinor.optional().nullable(),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  barcode: z.string().trim().max(60).optional().or(z.literal("")),
  lowStockThreshold: z.number().int().min(0).default(5),
  trackInventory: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isOutlet: z.boolean().default(false),
  tags: z.array(z.string().trim().max(40)).max(30).default([]),
  seoTitle: z.string().trim().max(160).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(320).optional().or(z.literal("")),
  categoryIds: z.array(z.string()).default([]),
  images: z.array(z.object({ url: z.string(), alt: z.string().optional() })).default([]),
  variants: z.array(variantInputSchema).default([]),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(200).optional().or(z.literal("")),
  parentId: z.string().optional().nullable(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  image: z.string().trim().optional().or(z.literal("")),
  position: z.number().int().default(0),
  isActive: z.boolean().default(true),
  showInNav: z.boolean().default(true),
  seoTitle: z.string().trim().max(160).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(320).optional().or(z.literal("")),
});

export const brandInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(120).optional().or(z.literal("")),
  logo: z.string().trim().optional().or(z.literal("")),
  banner: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  isFeatured: z.boolean().default(false),
  position: z.number().int().default(0),
});

export const couponInputSchema = z.object({
  code: z.string().trim().min(2).max(40).toUpperCase(),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  type: z.enum(["PERCENTAGE", "FIXED", "FREE_SHIPPING"]).default("PERCENTAGE"),
  value: z.number().int().min(0).default(0),
  minSubtotalCents: moneyMinor.optional().nullable(),
  maxRedemptions: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export const settingsInputSchema = z.object({
  storeName: z.string().trim().min(1).max(80),
  storeEmail: z.string().trim().toLowerCase().email(),
  supportPhone: z.string().trim().max(30).optional().or(z.literal("")),
  baseCurrency: z.string().trim().length(3),
  enableCOD: z.boolean(),
  enableBankTransfer: z.boolean(),
  enableCard: z.boolean(),
  enablePaypal: z.boolean(),
  codLimitCents: moneyMinor,
  freeShippingThresholdCents: moneyMinor.optional().nullable(),
  flatShippingCents: moneyMinor,
  bankTransferInstructions: z.string().trim().max(2000).optional().or(z.literal("")),
  announcementText: z.string().trim().max(200).optional().or(z.literal("")),
});

export const orderUpdateSchema = z.object({
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]).optional(),
  fulfillmentStatus: z
    .enum(["UNFULFILLED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"])
    .optional(),
  trackingNumber: z.string().trim().max(80).optional().or(z.literal("")),
  trackingCarrier: z.string().trim().max(80).optional().or(z.literal("")),
  adminNote: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
