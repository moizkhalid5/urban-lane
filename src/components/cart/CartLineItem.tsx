"use client";

import Image from "next/image";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCartItem, removeCartItem } from "@/app/actions/cart";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import type { CartLine } from "@/lib/cart";
import { cn } from "@/lib/utils";

export function CartLineItem({ line, currency }: { line: CartLine; currency: DisplayCurrency }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const overStock = line.quantity > line.stock || line.stock <= 0;

  function setQty(quantity: number) {
    startTransition(async () => {
      await updateCartItem({ itemId: line.id, quantity });
      router.refresh();
    });
  }
  function remove() {
    startTransition(async () => {
      await removeCartItem(line.id);
      router.refresh();
    });
  }

  return (
    <div className={cn("flex gap-4 py-6", pending && "opacity-60")}>
      <Link href={`/products/${line.slug}`} className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden bg-line-soft">
        {line.image && <Image src={line.image} alt={line.title} fill sizes="96px" className="object-cover" />}
      </Link>

      <div className="flex flex-1 flex-col">
        <div className="flex justify-between gap-4">
          <div>
            {line.brand && <p className="text-xs uppercase tracking-wide text-ink-muted">{line.brand}</p>}
            <Link href={`/products/${line.slug}`} className="text-sm font-medium hover:underline">
              {line.title}
            </Link>
            {line.variantLabel && <p className="mt-0.5 text-sm text-ink-muted">{line.variantLabel}</p>}
          </div>
          <p className="text-sm font-medium">{formatMoney(line.lineTotalCents, currency)}</p>
        </div>

        {overStock && (
          <p className="mt-1 text-xs text-sale">
            {line.stock <= 0 ? "Out of stock" : `Only ${line.stock} available`}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex items-center border border-line">
            <button onClick={() => setQty(line.quantity - 1)} disabled={pending} className="px-3 py-2" aria-label="Decrease">
              −
            </button>
            <span className="w-8 text-center text-sm">{line.quantity}</span>
            <button
              onClick={() => setQty(line.quantity + 1)}
              disabled={pending || line.quantity >= line.stock}
              className="px-3 py-2"
              aria-label="Increase"
            >
              +
            </button>
          </div>
          <button onClick={remove} disabled={pending} className="text-sm text-ink-muted underline hover:text-ink">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
