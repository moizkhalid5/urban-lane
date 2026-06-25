import type { ProductCard as ProductCardData } from "@/lib/queries/products";
import type { DisplayCurrency } from "@/lib/money";
import { ProductCard } from "./ProductCard";
import { cn } from "@/lib/utils";

export function ProductGrid({
  products,
  currency,
  className,
}: {
  products: ProductCardData[];
  currency: DisplayCurrency;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4", className)}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} currency={currency} />
      ))}
    </div>
  );
}
