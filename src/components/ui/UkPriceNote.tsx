import { formatMoney, type DisplayCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * "UK price Rs 17,300 · Save 28%": the product's real UK retail price next to ours (lib/pricing/uk-price).
 * A comparison with UK shops, not a former price of ours, so it's never struck through.
 */
export function UkPriceNote({
  uk,
  currency,
  detailed = false,
  className,
}: {
  uk: { cents: number; savePct: number };
  currency: DisplayCurrency;
  /** product page: adds what the UK price is */
  detailed?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-ink-muted", className)}>
      UK price {formatMoney(uk.cents, currency)} · <span className="font-medium text-sale">Save {uk.savePct}%</span>
      {detailed && <span className="block pt-0.5">The price of this item at UK retailers, converted to rupees.</span>}
    </p>
  );
}
