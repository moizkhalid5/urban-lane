"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type Facets = {
  brands: { slug: string; name: string }[];
  sizes: string[];
  colors: { name: string; hex: string | null }[];
  /** Display-currency price bounds for placeholder hints. */
  priceMin: number;
  priceMax: number;
};

const get = (p: URLSearchParams, key: string) => (p.get(key) ? p.get(key)!.split(",").filter(Boolean) : []);

export function Filters({
  facets,
  currencySymbol,
  hideBrand = false,
}: {
  facets: Facets;
  currencySymbol: string;
  hideBrand?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [openMobile, setOpenMobile] = useState(false);
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");

  const selectedBrands = get(params, "brands");
  const selectedSizes = get(params, "sizes");
  const selectedColors = get(params, "colors");
  const inStock = params.get("inStock") === "1";
  const onSale = params.get("sale") === "1";

  function applyPrice() {
    apply((p) => {
      if (min) p.set("min", min);
      else p.delete("min");
      if (max) p.set("max", max);
      else p.delete("max");
    });
  }

  function apply(mutate: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggleList(key: string, value: string) {
    apply((p) => {
      const list = get(p, key);
      const idx = list.indexOf(value);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(value);
      if (list.length) p.set(key, list.join(","));
      else p.delete(key);
    });
  }

  function toggleFlag(key: string) {
    apply((p) => (p.get(key) === "1" ? p.delete(key) : p.set(key, "1")));
  }

  function clearAll() {
    const next = new URLSearchParams();
    const sort = params.get("sort");
    if (sort) next.set("sort", sort);
    router.push(`${pathname}?${next.toString()}`);
  }

  const activeCount =
    selectedBrands.length + selectedSizes.length + selectedColors.length + (inStock ? 1 : 0) + (onSale ? 1 : 0);

  const body = (
    <div className="space-y-8">
      {activeCount > 0 && (
        <button onClick={clearAll} className="text-sm text-ink-muted underline hover:text-ink">
          Clear all ({activeCount})
        </button>
      )}

      {!hideBrand && facets.brands.length > 0 && (
        <FilterGroup title="Brand">
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {facets.brands.map((b) => (
              <Check
                key={b.slug}
                label={b.name}
                checked={selectedBrands.includes(b.slug)}
                onChange={() => toggleList("brands", b.slug)}
              />
            ))}
          </div>
        </FilterGroup>
      )}

      {facets.sizes.length > 0 && (
        <FilterGroup title="Size">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button
                key={s}
                onClick={() => toggleList("sizes", s)}
                className={cn(
                  "min-w-9 border px-3 py-1.5 text-sm transition-colors",
                  selectedSizes.includes(s) ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}

      {facets.colors.length > 0 && (
        <FilterGroup title="Colour">
          <div className="flex flex-wrap gap-3">
            {facets.colors.map((c) => (
              <button
                key={c.name}
                title={c.name}
                onClick={() => toggleList("colors", c.name)}
                className={cn(
                  "h-7 w-7 rounded-full border transition-transform",
                  selectedColors.includes(c.name) ? "ring-2 ring-ink ring-offset-2" : "border-line",
                )}
                style={{ backgroundColor: c.hex ?? "#ddd" }}
              />
            ))}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title={`Price (${currencySymbol})`}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder={String(facets.priceMin)}
            className="input px-2 py-1.5 text-sm"
            aria-label="Minimum price"
          />
          <span className="text-ink-muted">–</span>
          <input
            type="number"
            inputMode="numeric"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder={String(facets.priceMax)}
            className="input px-2 py-1.5 text-sm"
            aria-label="Maximum price"
          />
          <button onClick={applyPrice} className="border border-line px-3 py-1.5 text-sm hover:border-ink">
            Go
          </button>
        </div>
      </FilterGroup>

      <FilterGroup title="Availability">
        <Check label="In stock only" checked={inStock} onChange={() => toggleFlag("inStock")} />
        <Check label="On sale" checked={onSale} onChange={() => toggleFlag("sale")} />
      </FilterGroup>
    </div>
  );

  return (
    <>
      {/* desktop sidebar */}
      <aside className="hidden w-60 shrink-0 lg:block">{body}</aside>

      {/* mobile trigger + drawer */}
      <button
        onClick={() => setOpenMobile(true)}
        className="btn-ghost lg:hidden"
      >
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      {openMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpenMobile(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[85%] max-w-sm animate-drawer-in flex-col bg-white">
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <span className="font-medium uppercase tracking-wide">Filters</span>
              <button onClick={() => setOpenMobile(false)} aria-label="Close">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{body}</div>
            <div className="border-t border-line p-4">
              <button onClick={() => setOpenMobile(false)} className="btn-primary w-full">
                View results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-ink" />
      {label}
    </label>
  );
}
