import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getActiveCurrency } from "@/lib/currency.server";
import { getProductsByIds } from "@/lib/queries/product-detail";
import { ProductCard } from "@/components/product/ProductCard";
import { WishlistButton } from "@/components/product/WishlistButton";

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const currency = await getActiveCurrency();

  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { productId: true },
  });
  const products = await getProductsByIds(items.map((i) => i.productId));

  if (products.length === 0) {
    return (
      <div className="border border-dashed border-line p-12 text-center">
        <p className="text-lg font-medium">Your wishlist is empty</p>
        <p className="mt-1 text-sm text-ink-muted">Tap the heart on any product to save it here.</p>
        <Link href="/collections/women" className="btn-primary mt-6">Discover products</Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-lg font-medium">Wishlist</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
        {products.map((p) => (
          <div key={p.id}>
            <ProductCard product={p} currency={currency} />
            <div className="mt-2">
              <WishlistButton productId={p.id} initial authed variant="icon" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
