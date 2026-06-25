"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/app/actions/cart";
import { cn } from "@/lib/utils";

export type VariantOption = {
  id: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  stock: number;
};

export function AddToCart({ variants }: { variants: VariantOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const sizes = useMemo(() => unique(variants.map((v) => v.size)), [variants]);
  const colors = useMemo(() => uniqueColors(variants), [variants]);

  // Auto-select when there is only one option (no forced selection for single-option products).
  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0] : null);
  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0].name : null);
  const [qty, setQty] = useState(1);

  const needsSize = sizes.length > 1 && !size;
  const needsColor = colors.length > 1 && !color;

  const selected = useMemo(
    () =>
      variants.find(
        (v) => (sizes.length ? v.size === size : true) && (colors.length ? v.color === color : true),
      ) ?? (variants.length === 1 ? variants[0] : undefined),
    [variants, size, color, sizes.length, colors.length],
  );

  const maxQty = selected?.stock ?? 0;
  const outOfStock = selected ? selected.stock <= 0 : variants.every((v) => v.stock <= 0);

  function handleAdd(buyNow = false) {
    setMessage(null);
    if (needsSize) return setMessage({ ok: false, text: "Please select a size." });
    if (needsColor) return setMessage({ ok: false, text: "Please select a colour." });
    if (!selected) return setMessage({ ok: false, text: "Please select options." });
    if (selected.stock <= 0) return setMessage({ ok: false, text: "This option is out of stock." });

    startTransition(async () => {
      const res = await addToCart({ variantId: selected.id, quantity: qty });
      setMessage({ ok: res.ok, text: res.message ?? (res.ok ? "Added to bag." : "Could not add to bag.") });
      if (res.ok) {
        router.refresh();
        if (buyNow) router.push("/cart");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* size */}
      {sizes.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">Size</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const available = variants.some((v) => v.size === s && v.stock > 0);
              return (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  disabled={!available}
                  className={cn(
                    "min-w-12 border px-4 py-2 text-sm transition-colors",
                    size === s ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                    !available && "cursor-not-allowed text-ink-muted line-through opacity-50",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* color */}
      {colors.length > 0 && (
        <div>
          <span className="label">Colour{color ? `: ${color}` : ""}</span>
          <div className="flex flex-wrap gap-3">
            {colors.map((c) => {
              const available = variants.some((v) => v.color === c.name && v.stock > 0);
              return (
                <button
                  key={c.name}
                  title={c.name}
                  onClick={() => setColor(c.name)}
                  disabled={!available}
                  className={cn(
                    "h-9 w-9 rounded-full border transition-transform",
                    color === c.name ? "ring-2 ring-ink ring-offset-2" : "border-line",
                    !available && "cursor-not-allowed opacity-40",
                  )}
                  style={{ backgroundColor: c.hex ?? "#ddd" }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* stock status */}
      <StockStatus selected={selected} outOfStock={outOfStock} />

      {/* quantity + add */}
      <div className="flex items-stretch gap-3">
        <div className="flex items-center border border-line">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-3 py-3 text-lg"
            aria-label="Decrease quantity"
            disabled={qty <= 1}
          >
            −
          </button>
          <span className="w-10 text-center text-sm">{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(maxQty || 1, q + 1))}
            className="px-3 py-3 text-lg"
            aria-label="Increase quantity"
            disabled={maxQty > 0 && qty >= maxQty}
          >
            +
          </button>
        </div>
        <button onClick={() => handleAdd(false)} disabled={pending || outOfStock} className="btn-primary flex-1">
          {outOfStock ? "Sold out" : pending ? "Adding…" : "Add to bag"}
        </button>
      </div>

      <button onClick={() => handleAdd(true)} disabled={pending || outOfStock} className="btn-secondary w-full">
        Buy now
      </button>

      {message && (
        <p className={cn("text-sm", message.ok ? "text-success" : "text-sale")} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}

function StockStatus({ selected, outOfStock }: { selected?: VariantOption; outOfStock: boolean }) {
  if (!selected) return null;
  if (outOfStock) return <p className="text-sm text-sale">Out of stock</p>;
  if (selected.stock <= 5)
    return <p className="text-sm text-sale">Low stock — only {selected.stock} left</p>;
  return <p className="text-sm text-success">In stock</p>;
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}
function uniqueColors(variants: VariantOption[]): { name: string; hex: string | null }[] {
  const map = new Map<string, string | null>();
  for (const v of variants) if (v.color && !map.has(v.color)) map.set(v.color, v.colorHex);
  return [...map.entries()].map(([name, hex]) => ({ name, hex }));
}
