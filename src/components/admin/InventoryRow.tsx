"use client";

import { useState, useTransition } from "react";
import { setVariantStock } from "@/app/actions/admin-products";
import { cn } from "@/lib/utils";

export function InventoryRow({
  variantId,
  product,
  label,
  sku,
  stock,
  threshold,
}: {
  variantId: string;
  product: string;
  label: string;
  sku: string;
  stock: number;
  threshold: number;
}) {
  const [value, setValue] = useState(String(stock));
  const [saved, setSaved] = useState<boolean | null>(null);
  const [pending, start] = useTransition();

  const current = parseInt(value || "0", 10);
  const low = current <= 0 ? "out" : current <= threshold ? "low" : "ok";

  function save() {
    setSaved(null);
    start(async () => {
      const res = await setVariantStock(variantId, parseInt(value || "0", 10));
      setSaved(res.ok);
    });
  }

  return (
    <tr className="border-b border-line-soft last:border-0">
      <td className="p-3">{product}</td>
      <td className="p-3 text-ink-muted">{label || "—"}</td>
      <td className="p-3 text-ink-muted">{sku || "—"}</td>
      <td className="p-3">
        <span className={cn(
          "rounded-full px-2 py-0.5 text-xs",
          low === "out" ? "bg-red-50 text-red-700" : low === "low" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700",
        )}>
          {low === "out" ? "Out of stock" : low === "low" ? "Low" : "In stock"}
        </span>
      </td>
      <td className="p-3">
        <div className="flex items-center justify-end gap-2">
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => { setValue(e.target.value); setSaved(null); }}
            className="w-20 border border-line px-2 py-1 text-sm focus:border-ink focus:outline-none"
          />
          <button onClick={save} disabled={pending} className="border border-line px-3 py-1 text-sm hover:border-ink">
            {pending ? "…" : "Save"}
          </button>
          {saved === true && <span className="text-xs text-success">✓</span>}
          {saved === false && <span className="text-xs text-sale">!</span>}
        </div>
      </td>
    </tr>
  );
}
