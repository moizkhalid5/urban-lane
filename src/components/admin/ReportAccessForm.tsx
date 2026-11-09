"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveReportAccess } from "@/app/actions/analytics";

/**
 * Admin → Settings: read-only access to Google Analytics and Clarity, for the reports in Admin → Analytics.
 * The key and token are never shown again once saved (only which Google account the key is for).
 */
export function ReportAccessForm({
  initial,
}: {
  initial: { gaPropertyId: string; gaKeyEmail: string | null; clarityTokenSaved: boolean };
}) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(initial.gaPropertyId);
  const [key, setKey] = useState("");
  const [token, setToken] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = (extra: { removeGaKey?: boolean; removeClarityToken?: boolean } = {}) =>
    start(async () => {
      const res = await saveReportAccess({ gaPropertyId: propertyId, gaServiceKey: key, clarityApiToken: token, ...extra });
      setMsg({ ok: res.ok, text: res.message ?? "" });
      if (res.ok || res.message?.startsWith("Saved")) {
        setKey("");
        setToken("");
        router.refresh();
      }
    });

  return (
    <section className="card max-w-2xl p-5">
      <h2 className="font-medium">Reports in the admin</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Read-only access so <strong className="text-ink">Analytics</strong> in this admin can show your Google Analytics
        and Clarity figures. Sales and orders show there without it. The key and token are stored encrypted.
      </p>

      <h3 className="mt-5 text-sm font-medium">Google Analytics</h3>
      <div className="mt-2 grid gap-4">
        <div>
          <label className="label" htmlFor="ga-property">
            Property ID
          </label>
          <input
            id="ga-property"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            placeholder="512345678"
            inputMode="numeric"
            className="input max-w-xs"
          />
          <p className="mt-1 text-xs text-ink-muted">Google Analytics → Admin → Property details → Property ID (numbers only).</p>
        </div>
        <div>
          <label className="label" htmlFor="ga-key">
            Service account key
          </label>
          {initial.gaKeyEmail && (
            <p className="mb-2 text-sm text-success">
              ✓ Key saved for <span className="font-mono text-xs">{initial.gaKeyEmail}</span>
            </p>
          )}
          <textarea
            id="ga-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            rows={4}
            placeholder={initial.gaKeyEmail ? "Paste a new key here to replace it" : '{ "type": "service_account", ... }'}
            className="input font-mono text-xs"
            spellCheck={false}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-ink-muted">Open the .json key file Google downloaded, copy everything in it and paste it here.</p>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-medium">Microsoft Clarity</h3>
      <div className="mt-2">
        <label className="label" htmlFor="clarity-token">
          Data export API token
        </label>
        {initial.clarityTokenSaved && <p className="mb-2 text-sm text-success">✓ Token saved</p>}
        <input
          id="clarity-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={initial.clarityTokenSaved ? "Paste a new token here to replace it" : "Token"}
          className="input"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-ink-muted">Clarity → Settings → Data export → Generate new API token.</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" disabled={pending} className="btn-primary" onClick={() => save()}>
          {pending ? "Saving…" : "Save and check"}
        </button>
        {initial.gaKeyEmail && (
          <button type="button" disabled={pending} className="text-ink-muted underline hover:text-ink" onClick={() => save({ removeGaKey: true })}>
            Remove Google key
          </button>
        )}
        {initial.clarityTokenSaved && (
          <button type="button" disabled={pending} className="text-ink-muted underline hover:text-ink" onClick={() => save({ removeClarityToken: true })}>
            Remove Clarity token
          </button>
        )}
      </div>
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-success" : "text-sale"}`}>{msg.text}</p>}
    </section>
  );
}
