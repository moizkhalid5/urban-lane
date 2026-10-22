"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { importReviews, previewReviewImport } from "@/app/actions/reviews";
import type { ImportRow } from "@/lib/reviews/import";
import { Stars } from "@/components/reviews/Stars";

const TEMPLATE =
  "SKU,Name,City,Rating,Review,Title,Date,Source,Verified,Homepage\n" +
  '707-731,Ahmed,Lahore,5,"Fitting bohat achi hai, quality bhi zabardast.",Great jeans,15/09/2026,WhatsApp,Yes,Yes\n' +
  ',Sara,Karachi,5,"Fast delivery and lovely packaging.",,02/10/2026,Instagram,No,No\n';

/** Admin → Reviews → Import: paste rows from Excel (or a CSV file), preview, then add them all. */
export function ReviewImport() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [status, setStatus] = useState<"APPROVED" | "PENDING">("APPROVED");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const good = rows?.filter((r) => !r.error && !r.duplicate) ?? [];

  function preview() {
    setMsg(null);
    start(async () => {
      const res = await previewReviewImport(text);
      if (res.error) {
        setRows(null);
        setMsg({ ok: false, text: res.error });
      } else setRows(res.rows);
    });
  }

  function doImport() {
    start(async () => {
      const res = await importReviews(text, { status });
      setMsg({ ok: res.ok, text: res.ok ? `Imported ${res.added} reviews${res.skipped ? ` (skipped ${res.skipped})` : ""}.` : res.message ?? "Import failed." });
      if (res.ok) {
        setRows(null);
        setText("");
        router.refresh();
      }
    });
  }

  async function loadFile(file: File) {
    setText(await file.text());
    setRows(null);
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5">
        <h2 className="font-medium">1. Put your reviews in Excel</h2>
        <p className="text-sm text-ink-soft">
          One review per row. The first row must be these column names: <strong>SKU</strong> (or product name; leave empty for a
          review of the store), <strong>Name</strong>, <strong>City</strong>, <strong>Rating</strong> (1–5),{" "}
          <strong>Review</strong>, and optionally <strong>Title</strong>, <strong>Date</strong> (day/month/year),{" "}
          <strong>Source</strong> (WhatsApp, Instagram, In person…), <strong>Verified</strong> (Yes/No) and{" "}
          <strong>Homepage</strong> (Yes to show it in the homepage carousel).
        </p>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="urban-lane-reviews-template.csv" className="btn-secondary inline-block">
          Download template
        </a>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-medium">2. Paste them here</h2>
        <p className="text-sm text-ink-soft">
          In Excel, select the rows including the column names, copy (Ctrl+C), and paste below (Ctrl+V). Or choose a CSV file.
        </p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setRows(null);
          }}
          rows={8}
          placeholder={"SKU\tName\tCity\tRating\tReview\n707-731\tAhmed\tLahore\t5\tFitting bohat achi hai"}
          className="input font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={preview} disabled={pending || !text.trim()} className="btn-primary">
            {pending && !rows ? "Checking…" : "Check reviews"}
          </button>
          <label className="btn-secondary cursor-pointer">
            Choose CSV file
            <input type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
          </label>
        </div>
        {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-sale"}`}>{msg.text}</p>}
        {msg?.ok && (
          <Link href="/admin/reviews?tab=all" className="text-sm underline">
            See all reviews
          </Link>
        )}
      </section>

      {rows && (
        <section className="card p-5">
          <h2 className="font-medium">3. Check and import</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {good.length} ready to import
            {rows.length - good.length > 0 && `, ${rows.length - good.length} will be skipped (see the red notes)`}.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="p-2">Row</th>
                  <th className="p-2">Product</th>
                  <th className="p-2">Review</th>
                  <th className="p-2">Check</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className="border-b border-line-soft align-top last:border-0">
                    <td className="p-2 text-ink-muted">{r.line}</td>
                    <td className="p-2">{r.product ? r.product.title : r.productInput || <span className="text-ink-muted">Store review</span>}</td>
                    <td className="max-w-md p-2">
                      <div className="flex items-center gap-2">
                        {r.rating >= 1 && r.rating <= 5 && <Stars value={r.rating} size={12} />}
                        <span className="text-xs text-ink-muted">
                          {r.authorName}
                          {r.authorCity && `, ${r.authorCity}`} · {new Date(r.reviewedAt).toLocaleDateString("en-GB")}
                          {r.featured && " · homepage"}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-ink-soft">{r.body}</p>
                    </td>
                    <td className="p-2 text-xs">
                      {r.error ? (
                        <span className="text-sale">{r.error}</span>
                      ) : r.duplicate ? (
                        <span className="text-ink-muted">Already on the site</span>
                      ) : (
                        <span className="text-success">✓ Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              Import as
              <select value={status} onChange={(e) => setStatus(e.target.value as "APPROVED" | "PENDING")} className="input w-auto py-1.5">
                <option value="APPROVED">Approved (live now)</option>
                <option value="PENDING">Waiting for approval</option>
              </select>
            </label>
            <button type="button" onClick={doImport} disabled={pending || good.length === 0} className="btn-primary">
              {pending ? "Importing…" : `Import ${good.length} reviews`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
