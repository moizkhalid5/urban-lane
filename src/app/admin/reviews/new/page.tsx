import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/guards";
import { ReviewEditor } from "@/components/admin/ReviewEditor";

export const dynamic = "force-dynamic";

const safeBack = (v?: string) => (v && /^\/admin\/[\w/-]*$/.test(v) ? v : "/admin/reviews");

export default async function NewReviewPage({ searchParams }: { searchParams: Promise<{ product?: string; back?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const products = await prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, title: true }, orderBy: { title: "asc" } });

  return (
    <div className="space-y-6">
      <Link href={safeBack(sp.back)} className="text-sm text-ink-muted hover:text-ink">
        ← Back
      </Link>
      <h1 className="text-2xl font-medium">Add review</h1>
      <p className="max-w-2xl text-sm text-ink-muted">
        For feedback a customer gave you outside the website (WhatsApp, Instagram, in person). Enter it as they wrote it,
        with their name as they&apos;re happy for it to appear.
      </p>
      <ReviewEditor
        id={null}
        products={products}
        returnTo={safeBack(sp.back)}
        initial={{
          productId: products.some((p) => p.id === sp.product) ? sp.product! : "",
          authorName: "",
          authorCity: "",
          rating: 5,
          title: "",
          body: "",
          source: "WHATSAPP",
          status: "APPROVED",
          verifiedPurchase: true,
          featured: false,
          reviewedAt: new Date().toISOString().slice(0, 10),
        }}
      />
    </div>
  );
}
