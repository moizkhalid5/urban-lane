import type { Metadata } from "next";
import Link from "next/link";
import { getActiveCurrency } from "@/lib/currency.server";
import { getCurrentUser } from "@/lib/auth/guards";
import { getProductsByIds } from "@/lib/queries/product-detail";
import { getWishlistIds } from "@/lib/wishlist";
import { ProductCard } from "@/components/product/ProductCard";
import { WishlistButton } from "@/components/product/WishlistButton";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

/** Saved products, for everyone: from the account when logged in, otherwise from this device (lib/wishlist). */
export default async function WishlistPage() {
  const [user, currency, ids] = await Promise.all([getCurrentUser(), getActiveCurrency(), getWishlistIds()]);
  const products = await getProductsByIds(ids);

  return (
    <div className="container-site py-8">
      <h1 className="text-3xl font-medium">Wishlist</h1>
      {!user && products.length > 0 && (
        <p className="mt-2 text-sm text-ink-muted">
          Saved on this device.{" "}
          <Link href="/login?callbackUrl=/wishlist" className="underline">
            Log in
          </Link>{" "}
          to keep your wishlist on all your devices.
        </p>
      )}

      {products.length === 0 ? (
        <div className="mt-8 border border-dashed border-line p-12 text-center">
          <p className="text-lg font-medium">Your wishlist is empty</p>
          <p className="mt-1 text-sm text-ink-muted">Tap the heart on any product to save it here.</p>
          <Link href="/collections/women" className="btn-primary mt-6">
            Discover products
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {products.map((p) => (
            <div key={p.id} className="grid grid-rows-[1fr_auto]">
              <ProductCard product={p} currency={currency} />
              <div className="mt-2">
                <WishlistButton productId={p.id} initial variant="icon" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
