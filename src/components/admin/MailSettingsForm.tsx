"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkMailbox, saveMailbox, saveMailRoles } from "@/app/actions/mail";
import { cn } from "@/lib/utils";

export type MailboxRow = {
  address: string;
  displayName: string;
  hasPassword: boolean;
  lastError: string | null;
  lastSyncAt: string | null;
};
type RoleRow = { role: string; label: string; help: string };

/**
 * Admin → Settings → Email: each mailbox's password (stored encrypted), and which mailbox does which job.
 * Saving a password checks it against Hostinger straight away.
 */
export function MailSettingsForm({
  mailboxes,
  roles,
  assigned,
  webmail,
}: {
  mailboxes: MailboxRow[];
  roles: RoleRow[];
  assigned: Record<string, string>;
  webmail: string;
}) {
  return (
    <section className="card max-w-3xl p-5">
      <h2 className="font-medium">Email</h2>
      <p className="mt-1 text-sm text-ink-muted">
        The shop sends and reads email through your Hostinger mailboxes. Enter each mailbox&apos;s password (the one
        you use for{" "}
        <a href={webmail} target="_blank" rel="noreferrer" className="underline">
          Webmail
        </a>
        ). Passwords are stored encrypted. A mailbox without a password can&apos;t send, and its emails don&apos;t
        show in Inbox.
      </p>
      <div className="mt-4 divide-y divide-line border-y border-line">
        {mailboxes.map((m) => (
          <MailboxEditor key={m.address} row={m} jobs={roles.filter((r) => assigned[r.role] === m.address).map((r) => r.label)} />
        ))}
      </div>
      <RolesEditor roles={roles} assigned={assigned} mailboxes={mailboxes.map((m) => m.address)} />
    </section>
  );
}

function MailboxEditor({ row, jobs }: { row: MailboxRow; jobs: string[] }) {
  const router = useRouter();
  const [name, setName] = useState(row.displayName);
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      setMsg({ ok: res.ok, text: res.message ?? "" });
      if (res.ok) setPassword("");
      router.refresh();
    });

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{row.address}</p>
        <span className={cn("text-xs", row.hasPassword ? (row.lastError ? "text-sale" : "text-success") : "text-ink-muted")}>
          {row.hasPassword ? (row.lastError ? "Can't connect" : "Set up") : "No password yet"}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-ink-muted">{jobs.length ? `Used for: ${jobs.join(", ")}` : "Not used for any job yet."}</p>
      {row.lastError && <p className="mt-1 text-xs text-sale">Last error: {row.lastError}</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs text-ink-muted">
          Name people see
          <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" />
        </label>
        <label className="text-xs text-ink-muted">
          {row.hasPassword ? "New password (leave empty to keep)" : "Password"}
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input mt-1"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled={pending}
            className="btn-primary px-4"
            onClick={() => run(() => saveMailbox({ address: row.address, displayName: name, password }))}
          >
            {pending ? "…" : "Save"}
          </button>
          {row.hasPassword && (
            <button type="button" disabled={pending} className="btn-ghost px-3" onClick={() => run(() => checkMailbox(row.address))}>
              Test
            </button>
          )}
        </div>
      </div>
      {msg && <p className={cn("mt-2 text-sm", msg.ok ? "text-success" : "text-sale")} role="status">{msg.text}</p>}
    </div>
  );
}

function RolesEditor({ roles, assigned, mailboxes }: { roles: RoleRow[]; assigned: Record<string, string>; mailboxes: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState(assigned);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium">Which mailbox does what</h3>
      <div className="mt-3 space-y-3">
        {roles.map((r) => (
          <div key={r.role} className="grid gap-1 sm:grid-cols-[200px_1fr] sm:items-center">
            <div>
              <p className="text-sm">{r.label}</p>
              <p className="text-xs text-ink-muted">{r.help}</p>
            </div>
            <select
              value={value[r.role]}
              onChange={(e) => setValue((v) => ({ ...v, [r.role]: e.target.value }))}
              className="input"
              aria-label={r.label}
            >
              {mailboxes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 text-sm">
        <button
          type="button"
          disabled={pending}
          className="btn-primary"
          onClick={() =>
            start(async () => {
              const res = await saveMailRoles(value);
              setMsg({ ok: res.ok, text: res.message ?? "" });
              router.refresh();
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {msg && <span className={msg.ok ? "text-success" : "text-sale"}>{msg.text}</span>}
      </div>
    </div>
  );
}
