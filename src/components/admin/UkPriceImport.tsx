"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { importUkPrices, previewUkImport } from "@/app/actions/uk-price";
import type { UkImportPreview } from "@/lib/pricing/uk-import";
import { parseTable } from "@/lib/table";

const SKU_COLUMNS = ["product sku", "sku", "urbanlane sku"];
const PRICE_COLUMNS = ["uk online price", "uk price", "uk price (£)", "uk retail price", "uk rrp"];
const rupees = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;

/** Reads the pasted sheet in the browser and keeps only (SKU, UK price) pairs. */
function readPairs(text: string): { pairs: { sku: string; pounds: number }[]; error: string | null } {
  const table = parseTable(text);
  const headerIndex = table.slice(0, 10).findIndex((row) => {
    const cells = row.map((c) => c.trim().toLowerCase());
    return cells.some((c) => SKU_COLUMNS.includes(c)) && cells.some((c) => PRICE_COLUMNS.includes(c));
  });
  if (headerIndex < 0) {
    return { pairs: [], error: 'Couldn\'t find the column names. The pasted rows must include a header row with "Product SKU" (or "SKU") and "UK Online Price" (or "UK price").' };
  }
  const header = table[headerIndex].map((c) => c.trim().toLowerCase());
  const skuCols = SKU_COLUMNS.map((name) => header.indexOf(name)).filter((i) => i >= 0);
  const priceCol = header.findIndex((c) => PRICE_COLUMNS.includes(c));
  const pairs: { sku: string; pounds: number }[] = [];
  for (const row of table.slice(headerIndex + 1)) {
    const pounds = Number((row[priceCol] ?? "").replace(/[£,\s]/g, ""));
    if (!(pounds > 0)) continue;
    for (const col of skuCols) {
      const sku = (row[col] ?? "").trim();
      if (sku) pairs.push({ sku, pounds });
    }
  }
  return { pairs, error: pairs.length ? null : "No rows with a SKU and a UK price were found." };
}

/** Admin → Products → Import UK prices: paste the master sheet (or any sheet with SKU + UK price). */
export function UkPriceImport() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<UkImportPreview | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [pairs, setPairs] = useState<{ sku: string; pounds: number }[]>([]);

  const summary = useMemo(() => {
    if (!preview) return null;
    const shown = preview.rows.filter((r) => r.savePct !== null);
    const changed = preview.rows.filter((r) => r.previousPounds !== null && r.previousPounds !== r.pounds).length;
    return { shown, notShown: preview.rows.length - shown.length, changed };
  }, [preview]);

  function check() {
    setMsg(null);
    setPreview(null);
    const { pairs, error } = readPairs(text);
    if (error) return setMsg({ ok: false, text: error });
    setPairs(pairs);
    start(async () => {
      const res = await previewUkImport(pairs);
      if (!res.ok) setMsg({ ok: false, text: res.message });
      else setPreview(res.preview);
    });
  }

  function save() {
    start(async () => {
      const res = await importUkPrices(pairs);
      setMsg({ ok: res.ok, text: res.message ?? "" });
      if (res.ok) {
        setPreview(null);
        setText("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5">
        <h2 className="font-medium">1. Copy your sheet</h2>
        <p className="text-sm text-ink-soft">
          Open your master sheet in Excel, click any cell, press <strong>Ctrl+A</strong> then <strong>Ctrl+C</strong>, and
          paste below. Only two columns are used: <strong>Product SKU</strong> (or <strong>Urbanlane SKU</strong>) and{" "}
          <strong>UK Online Price</strong> in pounds. Any other sheet with a &ldquo;SKU&rdquo; and a &ldquo;UK price&rdquo;
          column works too.
        </p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
          }}
          rows={8}
          placeholder={"Product SKU\tUK Online Price\n5934143\t48\n7006088\t50.97"}
          className="input font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={check} disabled={pending || !text.trim()} className="btn-primary">
            {pending && !preview ? "Checking…" : "Check UK prices"}
          </button>
          {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-sale"}`}>{msg.text}</p>}
        </div>
      </section>

      {preview && summary && (
        <section className="card p-5">
          <h2 className="font-medium">2. Check and save</h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-soft">
            <li>
              <strong>{preview.rows.length}</strong> products matched. <strong>{summary.shown.length}</strong> will show
              &ldquo;UK price … · Save X%&rdquo; (ours is lower); {summary.notShown} won&apos;t (ours isn&apos;t lower).
            </li>
            {summary.changed > 0 && <li>{summary.changed} products already had a different UK price, which will be replaced.</li>}
            {preview.notFound.length > 0 && (
              <li>
                {preview.notFound.length} SKUs in the sheet aren&apos;t products on the site (skipped), e.g.{" "}
                {preview.notFound.slice(0, 5).join(", ")}.
              </li>
            )}
            <li>Rate: Rs {preview.rate} per £ (Admin → Settings), rounded to the nearest Rs 100.</li>
          </ul>
          <div className="mt-4 max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="sticky top-0 border-b border-line bg-white text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="p-2">Product</th>
                  <th className="p-2">Our price</th>
                  <th className="p-2">UK price</th>
                  <th className="p-2">Shoppers see</th>
                </tr>
              </thead>
              <tbody>
                {[...preview.rows]
                  .sort((a, b) => (b.savePct ?? -1) - (a.savePct ?? -1))
                  .map((r) => (
                    <tr key={r.productId} className="border-b border-line-soft last:border-0">
                      <td className="p-2">
                        {r.title} <span className="text-xs text-ink-muted">({r.sku})</span>
                      </td>
                      <td className="p-2">{rupees(r.ourPrice)}</td>
                      <td className="p-2">
                        £{r.pounds} ≈ {rupees(r.ukRupees)}
                      </td>
                      <td className="p-2">
                        {r.savePct !== null ? <span className="font-medium text-sale">Save {r.savePct}%</span> : <span className="text-ink-muted">—</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={save} disabled={pending} className="btn-primary">
              {pending ? "Saving…" : `Save UK prices for ${preview.rows.length} products`}
            </button>
            <Link href="/admin/products" className="text-sm text-ink-muted underline">
              Cancel
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
