"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFeaturedPick, moveFeaturedPick, removeFeaturedPick, type FeaturedResult } from "@/app/actions/featured";
import { cn } from "@/lib/utils";

type Department = { slug: string; title: string };
type Pick = {
  id: string;
  department: string;
  productId: string;
  title: string;
  sku: string | null;
  slug: string;
  image: string | null;
  hidden: boolean;
  soldOut: boolean;
};
type ProductOption = { id: string; title: string; sku: string | null; gender: string | null; image: string | null };

/** Admin → Homepage featured: one card per row (Men's, Women's, Kids'), each with its chosen products and a search to add more. */
export function FeaturedAdmin({ departments, picks, products, max }: { departments: Department[]; picks: Pick[]; products: ProductOption[]; max: number }) {
  return (
    <div className="space-y-6">
      {departments.map((d) => (
        <DepartmentCard key={d.slug} department={d} picks={picks.filter((p) => p.department === d.slug)} products={products} max={max} />
      ))}
    </div>
  );
}

function DepartmentCard({ department, picks, products, max }: { department: Department; picks: Pick[]; products: ProductOption[]; max: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<FeaturedResult>) =>
    start(async () => {
      const res = await fn();
      setError(res.ok ? null : (res.message ?? "Something went wrong."));
      router.refresh();
    });

  return (
    <section className={cn("card space-y-4 p-5", pending && "opacity-70")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">
          {department.title} row{" "}
          <span className="text-sm font-normal text-ink-muted">
            ({picks.length} of {max})
          </span>
        </h2>
        <p className="text-sm text-ink-muted">
          {picks.length ? "Showing the products below, in this order." : "None chosen: showing featured products automatically."}
        </p>
      </div>

      {picks.length > 0 && (
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {picks.map((p, i) => (
            <li key={p.id} className="flex gap-3 rounded border border-line p-2">
              <Thumb src={p.image} />
              <div className="min-w-0 flex-1 space-y-1">
                <a href={`/products/${p.slug}`} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm hover:underline">
                  {i + 1}. {p.title}
                </a>
                {p.sku && <p className="text-xs text-ink-muted">SKU {p.sku}</p>}
                {(p.hidden || p.soldOut) && (
                  <p className="text-xs text-sale">{p.hidden ? "Hidden on the shop" : "Sold out"}: skipped on the homepage</p>
                )}
                <div className="flex gap-3 pt-1 text-xs">
                  <button type="button" disabled={pending || i === 0} onClick={() => run(() => moveFeaturedPick(p.id, -1))} className="underline disabled:no-underline disabled:opacity-40">
                    ← Earlier
                  </button>
                  <button type="button" disabled={pending || i === picks.length - 1} onClick={() => run(() => moveFeaturedPick(p.id, 1))} className="underline disabled:no-underline disabled:opacity-40">
                    Later →
                  </button>
                  <button type="button" disabled={pending} onClick={() => run(() => removeFeaturedPick(p.id))} className="ml-auto text-sale underline">
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {picks.length < max && (
        <AddProduct department={department} products={products} chosen={new Set(picks.map((p) => p.productId))} pending={pending} onAdd={(id) => run(() => addFeaturedPick(department.slug, id))} />
      )}
      {error && <p className="text-sm text-sale">{error}</p>}
    </section>
  );
}

function AddProduct({
  department,
  products,
  chosen,
  pending,
  onAdd,
}: {
  department: Department;
  products: ProductOption[];
  chosen: Set<string>;
  pending: boolean;
  onAdd: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [onlyDept, setOnlyDept] = useState(true);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => !chosen.has(p.id))
      .filter((p) => !onlyDept || p.gender?.toLowerCase() === department.slug)
      .filter((p) => p.title.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, chosen, onlyDept, department.slug, query]);

  return (
    <div className="space-y-2 border-t border-line pt-4">
      <label className="label" htmlFor={`add-${department.slug}`}>
        Add a product
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id={`add-${department.slug}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or SKU…"
          className="input max-w-md text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" checked={onlyDept} onChange={(e) => setOnlyDept(e.target.checked)} />
          Only {department.title} products
        </label>
      </div>
      {query.trim() && results.length === 0 && <p className="text-sm text-ink-muted">No products found.</p>}
      {results.length > 0 && (
        <ul className="divide-y divide-line rounded border border-line">
          {results.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-2">
              <Thumb src={p.image} small />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{p.title}</p>
                {p.sku && <p className="text-xs text-ink-muted">SKU {p.sku}</p>}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  onAdd(p.id);
                  setQuery("");
                }}
                className="btn-secondary px-4 py-1.5 text-xs"
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thumb({ src, small }: { src: string | null; small?: boolean }) {
  const size = small ? "h-12 w-10" : "h-20 w-16";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
    <img src={src} alt="" className={cn(size, "shrink-0 rounded bg-line-soft object-cover")} />
  ) : (
    <div className={cn(size, "shrink-0 rounded bg-line-soft")} />
  );
}
