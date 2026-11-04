import Link from "next/link";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import type { BundleGroup } from "@/lib/bundle-rule";
import type { BundleHint } from "@/lib/bundles";

/** Bag and checkout summary: one line per colour bundle in the bag (inside a <dl>). */
export function BundleRows({ groups, percentOff, currency }: { groups: BundleGroup[]; percentOff: number; currency: DisplayCurrency }) {
  return groups.map((g) => (
    <div key={g.productId} className="flex justify-between gap-4 text-success">
      <dt>
        Colour bundle · {percentOff}% off
        <span className="block text-xs text-ink-muted">
          {g.title} ({g.colours.join(", ")})
        </span>
      </dt>
      <dd className="shrink-0">−{formatMoney(g.cents, currency)}</dd>
    </div>
  ));
}

/** "Add 1 more colour of X to save 10% on them." for products a colour or two short of a bundle. */
export function BundleHints({ hints, percentOff }: { hints: BundleHint[]; percentOff: number }) {
  if (hints.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {hints.map((h) => (
        <li key={h.productId} className="rounded bg-line-soft px-3 py-2 text-xs text-ink-soft">
          Add {h.missing} more {h.missing === 1 ? "colour" : "colours"} of{" "}
          <Link href={`/products/${h.slug}`} className="font-medium text-ink underline underline-offset-2">
            {h.title}
          </Link>{" "}
          to save {percentOff}% on them.
        </li>
      ))}
    </ul>
  );
}
