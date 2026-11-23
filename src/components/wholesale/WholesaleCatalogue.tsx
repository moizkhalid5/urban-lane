"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import { WHOLESALE_OFFER, offerPct, wholesaleMinor } from "@/lib/wholesale/offer";
import type { StockGroup, StockItem } from "@/lib/wholesale/stock";
import { cn } from "@/lib/utils";

const PAGE = 36;
const ORDER_KEY = "ul_wholesale_order";
const DEPARTMENT_NAMES: Record<string, string> = {
  women: "Women",
  men: "Men",
  kids: "Kids",
  beauty: "Beauty",
  jewellery: "Jewellery",
  unisex: "Unisex",
  other: "Other",
};
const deptName = (d: string) => DEPARTMENT_NAMES[d] ?? d;
/** "M&S Briefs…": the brand in front unless the product's name already starts with it */
const named = (i: StockItem) => (i.title.toLowerCase().startsWith(i.brand.toLowerCase()) ? i.title : `${i.brand} ${i.title}`);
const pcs = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "piece" : "pieces"}`;

type Sort = "pieces" | "price-low" | "price-high" | "brand";

/**
 * The wholesale page's stock: brands and departments by pieces in stock (click to filter), the full list with
 * sizes, pieces and wholesale prices, and an order a business owner builds by picking quantities. The order
 * shows the discount that applies to its total (WHOLESALE_OFFER) and is sent to us on WhatsApp. The order is
 * kept in this browser (localStorage) so it survives a reload.
 */
export function WholesaleCatalogue({
  items,
  brands,
  departments,
  currency,
  whatsapp,
  siteUrl,
}: {
  items: StockItem[];
  brands: StockGroup[];
  departments: StockGroup[];
  currency: DisplayCurrency;
  /** digits only, international form */
  whatsapp: string;
  siteUrl: string;
}) {
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState<Sort>("pieces");
  const [shown, setShown] = useState(PAGE);
  const [allBrands, setAllBrands] = useState(false);
  const [order, setOrder] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const money = (minor: number) => formatMoney(minor, currency);

  // the order survives a reload (this browser only)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "{}") as Record<string, number>;
      const valid = Object.fromEntries(
        Object.entries(saved)
          .filter(([id, n]) => byId.has(id) && n > 0)
          .map(([id, n]) => [id, Math.min(n, byId.get(id)!.pieces)]),
      );
      setOrder(valid);
    } catch {
      /* no saved order */
    }
  }, [byId]);
  useEffect(() => {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {
      /* private window: the order just isn't kept */
    }
  }, [order]);

  /** Sets a quantity (`n`), or changes it by `by` from the latest value (so quick taps all count). */
  const setQty = (id: string, n: number, by?: number) =>
    setOrder((o) => {
      const max = byId.get(id)?.pieces ?? 0;
      const want = by === undefined ? n : (o[id] ?? 0) + by;
      const v = Math.max(0, Math.min(max, Math.round(want) || 0));
      const next = { ...o };
      if (v) next[id] = v;
      else delete next[id];
      return next;
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter(
      (i) =>
        (!dept || i.department === dept) &&
        (!brand || i.brand === brand) &&
        (!q || `${i.title} ${i.brand} ${i.category}`.toLowerCase().includes(q)),
    );
    const sorted = [...list];
    if (sort === "price-low") sorted.sort((a, b) => a.priceMinor - b.priceMinor);
    if (sort === "price-high") sorted.sort((a, b) => b.priceMinor - a.priceMinor);
    if (sort === "brand") sorted.sort((a, b) => a.brand.localeCompare(b.brand) || b.pieces - a.pieces);
    return sorted;
  }, [items, query, dept, brand, sort]);
  const filteredPieces = filtered.reduce((n, i) => n + i.pieces, 0);

  // the order
  const lines = Object.entries(order)
    .map(([id, qty]) => ({ item: byId.get(id)!, qty }))
    .filter((l) => l.item);
  const totalPieces = lines.reduce((n, l) => n + l.qty, 0);
  const pct = offerPct(totalPieces);
  const shopTotal = lines.reduce((n, l) => n + l.item.priceMinor * l.qty, 0);
  const wholesaleTotal = lines.reduce((n, l) => n + wholesaleMinor(l.item.priceMinor, pct) * l.qty, 0);
  const toBulk = Math.max(0, WHOLESALE_OFFER.bulkMinPieces - totalPieces);

  const message = () => {
    const shown = lines.slice(0, 40);
    const rows = shown.map(
      (l) => `• ${l.qty} × ${named(l.item)} (${money(wholesaleMinor(l.item.priceMinor, pct))} each) ${siteUrl}/products/${l.item.slug}`,
    );
    if (lines.length > shown.length) rows.push(`• …and ${lines.length - shown.length} more items`);
    return [
      "Assalam-o-Alaikum Urban Lane, I'd like to order wholesale:",
      "",
      ...rows,
      "",
      `Total: ${pcs(totalPieces)}, ${pct}% off: ${money(wholesaleTotal)} (shop price ${money(shopTotal)})`,
      "",
      "Business name:",
      "City:",
    ].join("\n");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const topBrands = allBrands ? brands : brands.slice(0, 12);
  const maxBrand = brands[0]?.pieces || 1;

  return (
    <>
      {/* Stock by brand */}
      <section className="container-site py-12" aria-labelledby="brands-heading">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-muted">In stock now</p>
            <h2 id="brands-heading" className="mt-1 text-2xl font-medium md:text-3xl">
              Stock by brand
            </h2>
          </div>
          <p className="text-sm text-ink-muted">Tap a brand to see its pieces</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {topBrands.map((b) => (
            <button
              key={b.name}
              type="button"
              onClick={() => {
                setBrand(brand === b.name ? "" : b.name);
                setShown(PAGE);
                document.getElementById("stock")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={cn(
                "rounded-xl border p-4 text-left transition hover:border-ink",
                brand === b.name ? "border-ink bg-ink text-white" : "border-line bg-white",
              )}
            >
              <span className="block truncate text-sm font-medium">{b.name}</span>
              <span className="mt-2 block text-2xl font-semibold tabular-nums">{b.pieces.toLocaleString("en-US")}</span>
              <span className={cn("block text-xs", brand === b.name ? "text-white/70" : "text-ink-muted")}>
                pieces · {b.styles} {b.styles === 1 ? "style" : "styles"}
              </span>
              <span className={cn("mt-3 block h-1.5 overflow-hidden rounded-full", brand === b.name ? "bg-white/20" : "bg-line-soft")}>
                <span
                  className={cn("block h-full rounded-full", brand === b.name ? "bg-white" : "bg-ink")}
                  style={{ width: `${Math.max(4, (b.pieces / maxBrand) * 100)}%` }}
                />
              </span>
            </button>
          ))}
        </div>
        {brands.length > 12 && (
          <button type="button" onClick={() => setAllBrands(!allBrands)} className="mt-4 text-sm underline underline-offset-4">
            {allBrands ? "Show fewer brands" : `Show all ${brands.length} brands`}
          </button>
        )}
      </section>

      {/* The stock list and the order */}
      <section id="stock" className="scroll-mt-24 border-t border-line bg-line-soft/50 py-12" aria-labelledby="stock-heading">
        <div className="container-site">
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-muted">Pick quantities, send on WhatsApp</p>
            <h2 id="stock-heading" className="mt-1 text-2xl font-medium md:text-3xl">
              Full stock list
            </h2>
          </div>

          {/* Departments */}
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            {[{ name: "", pieces: departments.reduce((n, d) => n + d.pieces, 0), styles: 0 }, ...departments].map((d) => (
              <button
                key={d.name || "all"}
                type="button"
                onClick={() => {
                  setDept(d.name);
                  setShown(PAGE);
                }}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm transition",
                  dept === d.name ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink",
                )}
              >
                {d.name ? deptName(d.name) : "All"} <span className="tabular-nums opacity-70">{d.pieces.toLocaleString("en-US")}</span>
              </button>
            ))}
          </div>

          {/* Search, brand, sort */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(PAGE);
              }}
              placeholder="Search product, brand or type…"
              aria-label="Search the stock"
              className="input !w-full !py-2 sm:!w-72"
            />
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setShown(PAGE);
              }}
              aria-label="Brand"
              className="input !w-auto !py-2"
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} ({b.pieces})
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="input !w-auto !py-2">
              <option value="pieces">Most pieces first</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="brand">Brand A–Z</option>
            </select>
            <p className="text-sm text-ink-muted md:ml-auto">
              {filtered.length.toLocaleString("en-US")} styles · {filteredPieces.toLocaleString("en-US")} pieces
            </p>
          </div>

          <div className="mt-6 lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-8">
            {/* Products */}
            <div>
              <ul className="grid gap-3 md:grid-cols-2">
                {filtered.slice(0, shown).map((i) => {
                  const qty = order[i.id] ?? 0;
                  return (
                    <li key={i.id} className={cn("flex gap-4 rounded-xl border bg-white p-3", qty ? "border-ink" : "border-line")}>
                      <a
                        href={`/products/${i.slug}`}
                        target="_blank"
                        rel="noopener"
                        className="relative h-32 w-24 shrink-0 overflow-hidden rounded-lg bg-line-soft"
                      >
                        {i.image && <Image src={i.image} alt={i.title} fill sizes="96px" className="object-cover" />}
                      </a>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                          {i.brand} · {deptName(i.department)} · {i.category}
                        </p>
                        <a href={`/products/${i.slug}`} target="_blank" rel="noopener" className="mt-0.5 line-clamp-2 text-sm font-medium hover:underline">
                          {i.title}
                        </a>
                        <p className="mt-1.5 flex flex-wrap gap-1">
                          {i.sizes.slice(0, 8).map((s, n) => (
                            <span key={n} className="rounded border border-line px-1.5 py-0.5 text-[11px] tabular-nums">
                              {s.label} <span className="text-ink-muted">×{s.stock}</span>
                            </span>
                          ))}
                          {i.sizes.length > 8 && <span className="text-[11px] text-ink-muted">+{i.sizes.length - 8} more</span>}
                        </p>
                        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
                          <span className="font-semibold tabular-nums">{i.pieces} pcs</span>
                          <span className="text-ink-muted line-through tabular-nums">{money(i.priceMinor)}</span>
                          <span className="tabular-nums">
                            <span className="font-semibold">{money(wholesaleMinor(i.priceMinor, WHOLESALE_OFFER.basePct))}</span>{" "}
                            <span className="text-xs text-ink-muted">({WHOLESALE_OFFER.basePct}% off)</span>
                          </span>
                          <span className="tabular-nums text-success">
                            <span className="font-semibold">{money(wholesaleMinor(i.priceMinor, WHOLESALE_OFFER.bulkPct))}</span>{" "}
                            <span className="text-xs">({WHOLESALE_OFFER.bulkMinPieces}+ pcs)</span>
                          </span>
                        </div>
                        <div className="mt-auto flex items-center gap-2 pt-3">
                          <div className="flex items-center rounded-full border border-line">
                            <button type="button" onClick={() => setQty(i.id, 0, -1)} disabled={!qty} aria-label={`One less ${i.title}`} className="h-8 w-8 text-lg disabled:opacity-30">
                              −
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={i.pieces}
                              value={qty || ""}
                              placeholder="0"
                              onChange={(e) => setQty(i.id, Number(e.target.value))}
                              aria-label={`Quantity of ${i.title}`}
                              className="h-8 w-12 border-0 bg-transparent text-center text-sm tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button type="button" onClick={() => setQty(i.id, 0, 1)} disabled={qty >= i.pieces} aria-label={`One more ${i.title}`} className="h-8 w-8 text-lg disabled:opacity-30">
                              +
                            </button>
                          </div>
                          {qty < i.pieces && (
                            <button type="button" onClick={() => setQty(i.id, i.pieces)} className="text-xs underline underline-offset-4">
                              Take all {i.pieces}
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {!filtered.length && <p className="rounded-xl bg-white p-6 text-center text-sm text-ink-muted">Nothing matches. Try another search or brand.</p>}
              {filtered.length > shown && (
                <div className="mt-6 text-center">
                  <button type="button" onClick={() => setShown(shown + PAGE * 2)} className="btn-secondary">
                    Show more ({(filtered.length - shown).toLocaleString("en-US")} more styles)
                  </button>
                </div>
              )}
            </div>

            {/* The order */}
            <aside
              aria-label="Your wholesale order"
              // phones: a compact bar pinned above the bottom menu, only once something is picked
              className={cn(
                "sticky bottom-24 z-20 mt-6 rounded-2xl border border-ink bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] md:bottom-4 md:block md:p-5 lg:bottom-auto lg:top-24 lg:mt-0",
                totalPieces === 0 && "hidden",
              )}
            >
              <p className="hidden text-xs font-medium uppercase tracking-[0.2em] text-ink-muted md:block">Your order</p>
              {totalPieces === 0 ? (
                <p className="mt-2 text-sm text-ink-soft">
                  Pick quantities to see your price. Under {WHOLESALE_OFFER.bulkMinPieces} pieces: {WHOLESALE_OFFER.basePct}% off;{" "}
                  {WHOLESALE_OFFER.bulkMinPieces}+ pieces: flat {WHOLESALE_OFFER.bulkPct}% off.
                </p>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3 md:mt-2">
                    <span className="text-sm">
                      {pcs(totalPieces)} · {lines.length} {lines.length === 1 ? "style" : "styles"}
                    </span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", pct === WHOLESALE_OFFER.bulkPct ? "bg-success text-white" : "bg-ink text-white")}>
                      {pct}% off
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line-soft md:mt-3" aria-hidden>
                    <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.min(100, (totalPieces / WHOLESALE_OFFER.bulkMinPieces) * 100)}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-ink-muted">
                    {toBulk > 0 ? `Add ${toBulk} more ${toBulk === 1 ? "piece" : "pieces"} for flat ${WHOLESALE_OFFER.bulkPct}% off` : `You get the flat ${WHOLESALE_OFFER.bulkPct}% off`}
                  </p>
                  <div className="mt-3 flex items-center gap-3 md:mt-4 md:block">
                  <dl className="min-w-0 flex-1 space-y-1 text-sm">
                    <div className="hidden justify-between md:flex">
                      <dt className="text-ink-muted">Shop price</dt>
                      <dd className="tabular-nums text-ink-muted line-through">{money(shopTotal)}</dd>
                    </div>
                    <div className="flex flex-col font-semibold md:flex-row md:justify-between md:text-base">
                      <dt className="text-xs font-normal text-ink-muted md:text-base md:font-semibold md:text-ink">Your wholesale price</dt>
                      <dd className="tabular-nums">{money(wholesaleTotal)}</dd>
                    </div>
                    <div className="hidden justify-between text-success md:flex">
                      <dt>You save</dt>
                      <dd className="tabular-nums">{money(shopTotal - wholesaleTotal)}</dd>
                    </div>
                  </dl>
                  <a
                    href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message())}`}
                    target="_blank"
                    rel="noopener"
                    className="btn-primary block shrink-0 text-center md:mt-4 md:w-full"
                  >
                    <span className="md:hidden">Send on WhatsApp</span>
                    <span className="hidden md:inline">Send this order on WhatsApp</span>
                  </a>
                  </div>
                  <div className="mt-2 flex justify-between text-xs">
                    <button type="button" onClick={copy} className="underline underline-offset-4">
                      {copied ? "Copied" : "Copy the order"}
                    </button>
                    <button type="button" onClick={() => setOrder({})} className="text-ink-muted underline underline-offset-4">
                      Clear
                    </button>
                  </div>
                </>
              )}
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
