import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/guards";
import { RAIL_PLACEMENTS, ensureRailTables, getRailSettings } from "@/lib/rail/db";
import { RailAdmin } from "@/components/admin/RailAdmin";

export const dynamic = "force-dynamic";

/** Admin → Homepage rail: the garments hanging on the homepage rail, and where the rail goes. */
export default async function AdminRailPage() {
  const user = await requireStaff();
  await ensureRailTables();
  const [settings, collections, items, products] = await Promise.all([
    getRailSettings(),
    prisma.railCollection.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { _count: { select: { items: true } } } }),
    prisma.railItem.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { product: { select: { title: true, sku: true, slug: true, status: true } } },
    }),
    prisma.product.findMany({
      where: { status: { in: ["ACTIVE", "DRAFT"] } },
      orderBy: { title: "asc" },
      select: { id: true, title: true, sku: true, status: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium">Homepage rail</h1>
        <Link href="/" target="_blank" className="btn-secondary">
          View homepage
        </Link>
      </div>
      <p className="max-w-3xl text-sm text-ink-muted">
        Garments hang on a rail on the homepage, in collections that shoppers switch between with buttons above the
        rail (a collection appears once it has at least 2 garments). Hovering a garment (or tapping it on a phone)
        turns it to face the shopper, and its name, price, discount and sizes show below; clicking it opens the
        product. Each garment needs two photos of it on a hanger, a <strong>front</strong> and a <strong>side</strong>{" "}
        view, on a plain white background; the background is removed automatically when you upload. Price, discount
        and sizes always come from the linked product, so they stay up to date.
      </p>
      <RailAdmin
        canEditSettings={user.role === "ADMIN"}
        settings={settings}
        placements={RAIL_PLACEMENTS.map((p) => ({ key: p.key, label: p.label }))}
        collections={collections.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive, count: c._count.items }))}
        products={products.map((p) => ({ id: p.id, label: `${p.title}${p.sku ? ` (${p.sku})` : ""}`, title: p.title, draft: p.status !== "ACTIVE" }))}
        items={items.map((i) => ({
          id: i.id,
          productId: i.productId ?? "",
          collectionId: i.collectionId ?? "",
          productStatus: i.product?.status ?? null,
          productSlug: i.product?.slug ?? null,
          word: i.word ?? "",
          frontImage: i.frontImage,
          sideImage: i.sideImage,
          isActive: i.isActive,
        }))}
      />
    </div>
  );
}
