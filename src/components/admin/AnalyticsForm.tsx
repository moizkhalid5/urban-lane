"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAnalyticsIds } from "@/app/actions/analytics";

/** Admin → Settings: Google Analytics and Microsoft Clarity IDs (components/analytics/Analytics.tsx). */
export function AnalyticsForm({ initial }: { initial: { gaMeasurementId: string; clarityProjectId: string } }) {
  const router = useRouter();
  const [ids, setIds] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <section className="card max-w-2xl p-5">
      <h2 className="font-medium">Analytics</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Paste the IDs from your Google Analytics and Microsoft Clarity accounts. The shop then reports visits, products
        viewed, bags, checkouts and sales to Google Analytics, and records visits for Clarity&apos;s heatmaps and
        replays. Leave an ID empty to turn that tool off. Staff who are logged in aren&apos;t counted.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ga-id">
            Google Analytics measurement ID
          </label>
          <input
            id="ga-id"
            value={ids.gaMeasurementId}
            onChange={(e) => setIds({ ...ids, gaMeasurementId: e.target.value })}
            placeholder="G-AB12CD34EF"
            className="input"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-ink-muted">Google Analytics → Admin → Data streams → your website.</p>
        </div>
        <div>
          <label className="label" htmlFor="clarity-id">
            Microsoft Clarity project ID
          </label>
          <input
            id="clarity-id"
            value={ids.clarityProjectId}
            onChange={(e) => setIds({ ...ids, clarityProjectId: e.target.value })}
            placeholder="abcd1234ef"
            className="input"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-ink-muted">Clarity → Settings → Overview → Project ID.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          disabled={pending}
          className="btn-primary"
          onClick={() =>
            start(async () => {
              const res = await saveAnalyticsIds(ids);
              setMsg({ ok: res.ok, text: res.message ?? "" });
              if (res.ok) router.refresh();
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {msg && <span className={msg.ok ? "text-success" : "text-sale"}>{msg.text}</span>}
      </div>
    </section>
  );
}
