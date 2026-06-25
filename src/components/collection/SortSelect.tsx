"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const OPTIONS: { value: string; label: string }[] = [
  { value: "latest", label: "Latest" },
  { value: "featured", label: "Featured" },
  { value: "best-selling", label: "Best selling" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(v: string) {
    const next = new URLSearchParams(params.toString());
    next.set("sort", v);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-muted">Sort</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-line bg-white px-3 py-2 text-sm focus:border-ink focus:outline-none"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
