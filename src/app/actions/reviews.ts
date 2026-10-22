"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin, requireStaff } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { ensureReviewTables, getReviewSettings } from "@/lib/reviews/db";
import { prepareImport } from "@/lib/reviews/import";

export type ReviewResult = { ok: boolean; message?: string; id?: string };

const SOURCES = ["WEBSITE", "WHATSAPP", "INSTAGRAM", "FACEBOOK", "IN_STORE", "EMAIL", "OTHER"] as const;
const STATUSES = ["PENDING", "APPROVED", "HIDDEN"] as const;

function revalidateReviews(productSlug?: string | null) {
  revalidatePath("/admin/reviews");
  revalidatePath("/");
  if (productSlug) revalidatePath(`/products/${productSlug}`);
}

// ── Customers: write a review on the product page ──────────────────────────

const customerSchema = z.object({
  productId: z.string().min(1),
  authorName: z.string().trim().min(2, "Please enter your name.").max(60),
  authorCity: z.string().trim().max(60).optional().default(""),
  email: z.string().trim().email("Please enter a valid email.").max(191),
  rating: z.coerce.number().int().min(1, "Please choose a star rating.").max(5),
  title: z.string().trim().max(120).optional().default(""),
  body: z.string().trim().min(10, "Please write at least a few words.").max(2000),
  website: z.string().optional().default(""), // honeypot: left empty by people, filled by bots
});

export async function submitReview(input: unknown): Promise<ReviewResult> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;
  if (d.website) return { ok: true, message: "Thank you!" }; // bot: pretend it worked

  const settings = await getReviewSettings();
  if (!settings.allowCustomerReviews) return { ok: false, message: "Reviews are closed at the moment." };

  await ensureReviewTables();
  const product = await prisma.product.findFirst({ where: { id: d.productId, status: "ACTIVE" }, select: { id: true, slug: true } });
  if (!product) return { ok: false, message: "Product not found." };

  const email = d.email.toLowerCase();
  const user = await getCurrentUser();
  const already = await prisma.review.count({
    where: { productId: product.id, OR: [{ email }, ...(user ? [{ userId: user.id }] : [])] },
  });
  if (already > 0) return { ok: false, message: "You've already reviewed this product. Thank you!" };

  // "Verified buyer" when an order for this product exists under this email or account.
  const bought = await prisma.orderItem.count({
    where: { productId: product.id, order: { OR: [{ email }, ...(user ? [{ userId: user.id }] : [])] } },
  });

  await prisma.review.create({
    data: {
      productId: product.id,
      authorName: d.authorName,
      authorCity: d.authorCity || null,
      email,
      userId: user?.id ?? null,
      rating: d.rating,
      title: d.title || null,
      body: d.body,
      source: "WEBSITE",
      status: settings.autoApprove ? "APPROVED" : "PENDING",
      verifiedPurchase: bought > 0,
    },
  });
  revalidateReviews(product.slug);
  return {
    ok: true,
    message: settings.autoApprove ? "Thank you! Your review is now live." : "Thank you! Your review will appear once it has been checked.",
  };
}

// ── Admin: add / edit / moderate ───────────────────────────────────────────

const adminSchema = z.object({
  productId: z.string().optional().default(""),
  authorName: z.string().trim().min(1, "Enter the customer's name.").max(100),
  authorCity: z.string().trim().max(100).optional().default(""),
  rating: z.coerce.number().int().min(1, "Choose a star rating.").max(5),
  title: z.string().trim().max(150).optional().default(""),
  body: z.string().trim().min(2, "Enter the review text.").max(5000),
  source: z.enum(SOURCES),
  status: z.enum(STATUSES),
  verifiedPurchase: z.boolean(),
  featured: z.boolean(),
  reviewedAt: z.string().optional().default(""), // yyyy-mm-dd
});

function parseDate(s: string): Date {
  const d = s ? new Date(`${s}T12:00:00`) : new Date();
  return Number.isNaN(d.getTime()) || d > new Date() ? new Date() : d;
}

async function nextFeaturedPosition(): Promise<number> {
  const last = await prisma.review.findFirst({ where: { featured: true }, orderBy: { featuredPosition: "desc" }, select: { featuredPosition: true } });
  return (last?.featuredPosition ?? 0) + 1;
}

export async function saveReview(id: string | null, input: unknown): Promise<ReviewResult> {
  const user = await requireStaff();
  const parsed = adminSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;
  await ensureReviewTables();

  const product = d.productId ? await prisma.product.findUnique({ where: { id: d.productId }, select: { id: true, slug: true } }) : null;
  if (d.productId && !product) return { ok: false, message: "That product no longer exists." };

  const existing = id ? await prisma.review.findUnique({ where: { id }, include: { product: { select: { slug: true } } } }) : null;
  if (id && !existing) return { ok: false, message: "Review not found." };

  const data = {
    productId: product?.id ?? null,
    authorName: d.authorName,
    authorCity: d.authorCity || null,
    rating: d.rating,
    title: d.title || null,
    body: d.body,
    source: d.source,
    status: d.status,
    verifiedPurchase: d.verifiedPurchase,
    featured: d.featured,
    reviewedAt: parseDate(d.reviewedAt),
    ...(d.featured && !existing?.featured ? { featuredPosition: await nextFeaturedPosition() } : {}),
  };

  const saved = existing
    ? await prisma.review.update({ where: { id: existing.id }, data })
    : await prisma.review.create({ data });
  await logAudit(user.id, existing ? "review.update" : "review.create", "Review", saved.id);
  revalidateReviews(product?.slug);
  if (existing?.product?.slug && existing.product.slug !== product?.slug) revalidatePath(`/products/${existing.product.slug}`);
  return { ok: true, id: saved.id, message: "Review saved." };
}

export async function setReviewStatus(id: string, status: (typeof STATUSES)[number]): Promise<ReviewResult> {
  const user = await requireStaff();
  if (!STATUSES.includes(status)) return { ok: false, message: "Invalid status." };
  await ensureReviewTables();
  const r = await prisma.review.update({ where: { id }, data: { status }, include: { product: { select: { slug: true } } } });
  await logAudit(user.id, `review.${status.toLowerCase()}`, "Review", id);
  revalidateReviews(r.product?.slug);
  return { ok: true };
}

export async function setReviewFeatured(id: string, featured: boolean): Promise<ReviewResult> {
  const user = await requireStaff();
  await ensureReviewTables();
  const r = await prisma.review.update({
    where: { id },
    data: { featured, ...(featured ? { featuredPosition: await nextFeaturedPosition() } : {}) },
  });
  await logAudit(user.id, featured ? "review.feature" : "review.unfeature", "Review", r.id);
  revalidateReviews();
  return { ok: true };
}

/** Moves a homepage review one place earlier (-1) or later (+1) in the carousel. */
export async function moveFeaturedReview(id: string, direction: -1 | 1): Promise<ReviewResult> {
  await requireStaff();
  await ensureReviewTables();
  const list = await prisma.review.findMany({
    where: { featured: true },
    orderBy: [{ featuredPosition: "asc" }, { reviewedAt: "desc" }],
    select: { id: true },
  });
  const i = list.findIndex((r) => r.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  await prisma.$transaction(list.map((r, pos) => prisma.review.update({ where: { id: r.id }, data: { featuredPosition: pos + 1 } })));
  revalidateReviews();
  return { ok: true };
}

export async function deleteReview(id: string): Promise<ReviewResult> {
  const user = await requireStaff();
  await ensureReviewTables();
  const r = await prisma.review.delete({ where: { id }, include: { product: { select: { slug: true } } } });
  await logAudit(user.id, "review.delete", "Review", id);
  revalidateReviews(r.product?.slug);
  return { ok: true };
}

const settingsSchema = z.object({
  minReviewsForStars: z.coerce.number().int().min(1).max(100),
  minSoldToShow: z.coerce.number().int().min(1).max(100000),
  allowCustomerReviews: z.boolean(),
  autoApprove: z.boolean(),
});

export async function updateReviewSettings(input: unknown): Promise<ReviewResult> {
  const user = await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please enter whole numbers of 1 or more." };
  await ensureReviewTables();
  await prisma.reviewSettings.upsert({ where: { id: "singleton" }, update: parsed.data, create: { id: "singleton", ...parsed.data } });
  await logAudit(user.id, "review.settings", "ReviewSettings", "singleton", parsed.data);
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

// ── Admin: bulk import (Admin → Reviews → Import) ──────────────────────────

export async function previewReviewImport(text: string) {
  await requireStaff();
  await ensureReviewTables();
  return prepareImport(String(text ?? ""));
}

export async function importReviews(
  text: string,
  options: { status: "APPROVED" | "PENDING" },
): Promise<ReviewResult & { added?: number; skipped?: number }> {
  const user = await requireStaff();
  await ensureReviewTables();
  const { rows, error } = await prepareImport(String(text ?? ""));
  if (error) return { ok: false, message: error };
  const good = rows.filter((r) => !r.error && !r.duplicate);
  if (good.length === 0) return { ok: false, message: "Nothing to import: every row has a problem or is already on the site." };

  let position = good.some((r) => r.featured) ? await nextFeaturedPosition() : 0;
  await prisma.$transaction(
    good.map((r) =>
      prisma.review.create({
        data: {
          productId: r.product?.id ?? null,
          authorName: r.authorName,
          authorCity: r.authorCity,
          rating: r.rating,
          title: r.title,
          body: r.body,
          source: r.source as (typeof SOURCES)[number],
          status: options.status === "PENDING" ? "PENDING" : "APPROVED",
          verifiedPurchase: r.verifiedPurchase,
          featured: r.featured,
          featuredPosition: r.featured ? position++ : 0,
          reviewedAt: new Date(r.reviewedAt),
        },
      }),
    ),
  );
  await logAudit(user.id, "review.import", "Review", undefined, { added: good.length, skipped: rows.length - good.length });
  for (const slug of new Set(good.map((r) => r.product?.slug).filter(Boolean))) revalidatePath(`/products/${slug}`);
  revalidateReviews();
  return { ok: true, added: good.length, skipped: rows.length - good.length, message: `Imported ${good.length} reviews.` };
}
