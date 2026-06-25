import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, brands] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    prisma.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true } }),
    prisma.brand.findMany({ select: { slug: true, updatedAt: true } }),
  ]);

  const staticPages = [
    "",
    "/brands",
    "/about",
    "/contact",
    "/faq",
    "/shipping-policy",
    "/returns",
    "/privacy-policy",
    "/terms",
  ].map((path) => ({
    url: `${APP_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));

  return [
    ...staticPages,
    ...categories.map((c) => ({
      url: `${APP_URL}/collections/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${APP_URL}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...brands.map((b) => ({
      url: `${APP_URL}/brands/${b.slug}`,
      lastModified: b.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
