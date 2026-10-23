"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { swatchFor } from "@/lib/colors";

export type Facets = {
  brands: { slug: string; name: string }[];
  /** Normalised size labels (see lib/sizes), already in display order. */
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
  categories = [],
}: {
  facets: Facets;
  currencySymbol: string;
  hideBrand?: boolean;
  /** Sub-categories of the current page, listed under "Category". */
  categories?: { name: string; slug: string }[];
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
  const priceActive = !!(params.get("min") || params.get("max"));

  function apply(mutate: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`); // back to the top: results (and the page above them) change
  }

  function applyPrice() {
    apply((p) => {
      if (min) p.set("min", min);
      else p.delete("min");
      if (max) p.set("max", max);
      else p.delete("max");
    });
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
    // Sort order and a banner's view (?gender=men, ?save=25-35) aren't filters; keep them.
    for (const key of ["sort", "gender", "save"]) {
      const value = params.get(key);
      if (value) next.set(key, value);
    }
    setMin("");
    setMax("");
    router.push(`${pathname}?${next.toString()}`); // back to the top: results (and the page above them) change
  }

  const activeCount =
    selectedBrands.length +
    selectedSizes.length +
    selectedColors.length +
    (inStock ? 1 : 0) +
    (onSale ? 1 : 0) +
    (priceActive ? 1 : 0);

  const body = (
    <div className="divide-y divide-white bg-line-soft">
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-base font-semibold">All Filters</span>
        {activeCount > 0 && (
          <button onClick={clearAll} className="text-sm text-ink-muted underline hover:text-ink">
            Clear all ({activeCount})
          </button>
        )}
      </div>

      {categories.length > 0 && (
        <Section title="Category">
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/collections/${c.slug}`} className="text-sm text-ink-soft hover:text-ink hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!hideBrand && facets.brands.length > 0 && (
        <Section title="Brand" count={selectedBrands.length}>
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {facets.brands.map((b) => (
              <Check key={b.slug} label={b.name} checked={selectedBrands.includes(b.slug)} onChange={() => toggleList("brands", b.slug)} />
            ))}
          </div>
        </Section>
      )}

      {facets.sizes.length > 0 && (
        <Section title="Size" count={selectedSizes.length}>
          <div className="flex max-h-60 flex-wrap gap-2 overflow-y-auto pr-1">
            {facets.sizes.map((s) => (
              <button
                key={s}
                onClick={() => toggleList("sizes", s)}
                className={cn(
                  "min-w-10 border bg-white px-2.5 py-1 text-xs transition-colors",
                  selectedSizes.includes(s) ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </Section>
      )}

      {facets.colors.length > 0 && (
        <Section title="Colour" count={selectedColors.length}>
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {facets.colors.map((c) => {
              const swatch = c.hex ?? swatchFor(c.name);
              return (
                <Check
                  key={c.name}
                  label={c.name}
                  checked={selectedColors.includes(c.name)}
                  onChange={() => toggleList("colors", c.name)}
                  swatch={swatch}
                />
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Price" count={priceActive ? 1 : 0}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder={`${currencySymbol} ${facets.priceMin}`}
            className="input bg-white px-2 py-1.5 text-sm"
            aria-label="Minimum price"
          />
          <span className="text-ink-muted">–</span>
          <input
            type="number"
            inputMode="numeric"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder={`${currencySymbol} ${facets.priceMax}`}
            className="input bg-white px-2 py-1.5 text-sm"
            aria-label="Maximum price"
          />
          <button onClick={applyPrice} className="border border-line bg-white px-3 py-1.5 text-sm hover:border-ink">
            Go
          </button>
        </div>
      </Section>

      <Section title="Availability" count={(inStock ? 1 : 0) + (onSale ? 1 : 0)}>
        <div className="space-y-2">
          <Check label="In stock only" checked={inStock} onChange={() => toggleFlag("inStock")} />
          <Check label="On sale" checked={onSale} onChange={() => toggleFlag("sale")} />
        </div>
      </Section>
    </div>
  );

  return (
    <>
      {/* Desktop: stays in view while the products scroll (below the sticky site header). */}
      <aside className="hidden w-64 shrink-0 self-start lg:sticky lg:top-40 lg:block lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto">
        {body}
      </aside>

      {/* Mobile: trigger + drawer */}
      <button onClick={() => setOpenMobile(true)} className="btn-ghost mb-4 lg:hidden">
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
            <div className="flex-1 overflow-y-auto">{body}</div>
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

/** Collapsible filter row; opens by default when it has an active selection. */
function Section({ title, count = 0, children }: { title: string; count?: number; children: ReactNode }) {
  const [open, setOpen] = useState(count > 0);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-4 text-left text-[15px] font-medium hover:bg-line/40"
      >
        <span>
          {title}
          {count > 0 && <span className="ml-2 rounded-full bg-ink px-1.5 py-0.5 text-[10px] text-white">{count}</span>}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
          className={cn("transition-transform", open && "rotate-180")}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
  swatch,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  swatch?: string | null;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-ink" />
      {swatch !== undefined && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 rounded-full border border-line"
          style={{ background: swatch ?? "transparent", borderStyle: swatch ? "solid" : "dashed" }}
        />
      )}
      {label}
    </label>
  );
}
