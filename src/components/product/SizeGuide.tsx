import { cn } from "@/lib/utils";
import { sizeKeys, type SizeGuide as Guide } from "@/lib/sizing/charts";

/**
 * Product page → Size Guide: the brand's own size chart for this kind of product (lib/sizing/charts.ts),
 * with the sizes this product comes in highlighted, plus how to measure.
 */
export function SizeGuide({ guide, sizes }: { guide: Guide; sizes: string[] }) {
  const keys = sizeKeys(sizes);
  return (
    <div className="space-y-5">
      {sizes.length > 0 && (
        <p>
          This item comes in <span className="font-medium text-ink">{sizes.join(", ")}</span>; those sizes are highlighted below.
        </p>
      )}
      {guide.tables.map((t) => (
        <div key={t.title}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink">{t.title}</p>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[320px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line">
                  {t.columns.map((c) => (
                    <th key={c} scope="col" className="whitespace-nowrap py-2 pr-3 font-medium text-ink">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((row) => {
                  const mine = row.keys.some((k) => keys.has(k));
                  return (
                    <tr key={row.size} className={cn("border-b border-line-soft", mine && "bg-line-soft font-medium text-ink")}>
                      {row.cells.map((c, i) => (
                        <td key={i} className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                          {i === 0 && mine ? <span className="border-b border-ink">{c}</span> : c}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <ul className="list-disc space-y-1 pl-5">
        {guide.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="text-xs text-ink-muted">{guide.source} Body measurements, not garment measurements. Still unsure? Message us on WhatsApp with your measurements and we&apos;ll help you choose.</p>
    </div>
  );
}
