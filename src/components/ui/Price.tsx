import { formatMoney, discountPercent, type DisplayCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = {
  cents: number;
  compareAtCents?: number | null;
  currency: DisplayCurrency;
  className?: string;
  size?: "sm" | "md" | "lg";
};

/** Renders a price, with strikethrough compare-at and a sale badge when on sale. */
export function Price({ cents, compareAtCents, currency, className, size = "md" }: Props) {
  const onSale = !!compareAtCents && compareAtCents > cents;
  const pct = discountPercent(cents, compareAtCents);
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-lg" };

  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className={cn(sizes[size], onSale ? "font-medium text-sale" : "font-medium text-ink")}>
        {formatMoney(cents, currency)}
      </span>
      {onSale && (
        <>
          <span className={cn("text-ink-muted line-through", sizes.sm)}>
            {formatMoney(compareAtCents!, currency)}
          </span>
          {pct != null && (
            <span className="text-xs font-medium uppercase tracking-wide text-sale">-{pct}%</span>
          )}
        </>
      )}
    </div>
  );
}
