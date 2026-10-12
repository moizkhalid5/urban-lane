import Link from "next/link";
import Image from "next/image";
import type { ProductCard as ProductCardData } from "@/lib/queries/products";
import type { DisplayCurrency } from "@/lib/money";
import { Price } from "@/components/ui/Price";

export function ProductCard({ product, currency }: { product: ProductCardData; currency: DisplayCurrency }) {
  const onSale = !!product.compareAtCents && product.compareAtCents > product.priceCents;

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-line-soft">
        {product.image ? (
          <>
            <Image
              src={product.image}
              alt={product.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
            {/* Fades in over the first image, so a slow second image never leaves the card blank. */}
            {product.secondImage && (
              <Image
                src={product.secondImage}
                alt={product.title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-ink-muted">No image</div>
        )}

        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {onSale && (
            <span className="bg-sale px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
              Sale
            </span>
          )}
          {!product.inStock && (
            <span className="bg-ink px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
              Sold out
            </span>
          )}
        </div>
      </div>

      <div className="pt-3">
        {product.brand && (
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">{product.brand}</p>
        )}
        <h3 className="mt-0.5 text-sm text-ink transition-colors group-hover:text-ink-muted">
          {product.title}
        </h3>
        <div className="mt-1">
          <Price cents={product.priceCents} compareAtCents={product.compareAtCents} currency={currency} size="sm" />
        </div>
        {product.colors.length > 1 && (
          <div className="mt-2 flex gap-1">
            {product.colors.slice(0, 5).map((c) => (
              <span
                key={c.name}
                title={c.name}
                className="h-3 w-3 rounded-full border border-line"
                style={{ backgroundColor: c.hex ?? "#ddd" }}
              />
            ))}
            {product.colors.length > 5 && (
              <span className="text-[10px] text-ink-muted">+{product.colors.length - 5}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
