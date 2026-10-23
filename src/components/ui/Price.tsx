import { formatMoney, discountPercent, type DisplayCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = {
  cents: number;
  compareAtCents?: number | null;
  /** The item's real UK retail price when it's higher than ours (lib/pricing/uk-price). */
  uk?: { cents: number; savePct: number } | null;
  currency: DisplayCurrency;
  className?: string;
  size?: "sm" | "md" | "lg";
};

/**
 * Renders a price, with strikethrough compare-at and a sale badge when on sale. Without a sale, a real UK
 * retail price is shown the same way but labelled "RRP", so it reads as a retail price, not a former price of ours.
 */
export function Price({ cents, compareAtCents, uk, currency, className, size = "md" }: Props) {
  const onSale = !!compareAtCents && compareAtCents > cents;
  const pct = discountPercent(cents, compareAtCents);
  const showUk = !onSale && !!uk;
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-lg" };

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn(sizes[size], onSale || showUk ? "font-medium text-sale" : "font-medium text-ink")}>
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
      {showUk && (
        // On cards it gets its own line, so narrow phone cards don't wrap it unevenly
        <span className={cn("flex items-baseline gap-2", size === "sm" && "w-full")}>
          <span className={cn("text-ink-muted", size === "lg" ? "text-sm" : "text-xs")}>
            RRP <span className="line-through">{formatMoney(uk!.cents, currency)}</span>
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-sale">-{uk!.savePct}%</span>
        </span>
      )}
    </div>
  );
}
