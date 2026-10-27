import Link from "next/link";
import type { ProductCard as ProductCardData } from "@/lib/queries/products";
import { ProductCardImages } from "./ProductCardImages";
import type { DisplayCurrency } from "@/lib/money";
import { Price } from "@/components/ui/Price";
import { Stars } from "@/components/reviews/Stars";

/** A product in a grid or row, in a thin rounded box: photo, then brand, name, rating, price and colours. */
export function ProductCard({ product, currency }: { product: ProductCardData; currency: DisplayCurrency }) {
  const onSale = !!product.compareAtCents && product.compareAtCents > product.priceCents;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-white transition-shadow hover:shadow-[0_2px_14px_rgba(0,0,0,0.07)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-line-soft">
        {product.image ? (
          <ProductCardImages image={product.image} secondImage={product.secondImage} alt={product.title} />
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

      <div className="flex flex-1 flex-col px-2.5 pb-3 pt-2.5">
        {product.brand && (
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">{product.brand}</p>
        )}
        <h3 className="mt-0.5 text-sm text-ink transition-colors group-hover:text-ink-muted">
          {product.title}
        </h3>
        {(product.rating || product.sold) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink-muted">
            {product.rating && (
              <>
                <Stars value={product.rating.average} size={12} />
                <span>
                  {product.rating.average.toFixed(1)} ({product.rating.count})
                </span>
              </>
            )}
            {product.rating && product.sold && <span aria-hidden>·</span>}
            {product.sold && <span>{product.sold} sold</span>}
          </div>
        )}
        <div className="mt-1">
          <Price
            cents={product.priceCents}
            compareAtCents={product.compareAtCents}
            uk={product.ukPrice}
            currency={currency}
            size="sm"
          />
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
