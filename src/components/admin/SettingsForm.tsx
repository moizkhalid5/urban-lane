"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSettings } from "@/app/actions/admin-settings";

export type SettingsData = {
  storeName: string;
  storeEmail: string;
  supportPhone: string;
  baseCurrency: string;
  enableCOD: boolean;
  enableBankTransfer: boolean;
  enableCard: boolean;
  enablePaypal: boolean;
  codLimit: string; // major units
  freeShippingThreshold: string;
  flatShipping: string;
  bankTransferInstructions: string;
  announcementText: string;
};

const toCents = (v: string) => Math.round(parseFloat(v || "0") * 100);

export function SettingsForm({ initial }: { initial: SettingsData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [d, setD] = useState(initial);
  const set = <K extends keyof SettingsData>(k: K, v: SettingsData[K]) => setD((s) => ({ ...s, [k]: v }));

  function save() {
    setMsg(null);
    start(async () => {
      const res = await updateSettings({
        storeName: d.storeName,
        storeEmail: d.storeEmail,
        supportPhone: d.supportPhone,
        baseCurrency: d.baseCurrency,
        enableCOD: d.enableCOD,
        enableBankTransfer: d.enableBankTransfer,
        enableCard: d.enableCard,
        enablePaypal: d.enablePaypal,
        codLimitCents: toCents(d.codLimit),
        freeShippingThresholdCents: d.freeShippingThreshold ? toCents(d.freeShippingThreshold) : null,
        flatShippingCents: toCents(d.flatShipping),
        bankTransferInstructions: d.bankTransferInstructions,
        announcementText: d.announcementText,
      });
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Saved." : "Error.") });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-sale"}`}>{msg.text}</p>}

      <Card title="Store">
        <Text label="Store name" value={d.storeName} onChange={(v) => set("storeName", v)} />
        <Text label="Store email (notifications)" value={d.storeEmail} onChange={(v) => set("storeEmail", v)} />
        <Text label="Support phone" value={d.supportPhone} onChange={(v) => set("supportPhone", v)} />
        <Text label="Announcement bar text" value={d.announcementText} onChange={(v) => set("announcementText", v)} />
      </Card>

      <Card title="Payments">
        <Toggle label="Cash on Delivery (COD)" checked={d.enableCOD} onChange={(v) => set("enableCOD", v)} />
        <Text label="COD limit (base currency)" value={d.codLimit} onChange={(v) => set("codLimit", v)} />
        <Toggle label="Bank Transfer" checked={d.enableBankTransfer} onChange={(v) => set("enableBankTransfer", v)} />
        <Area label="Bank transfer instructions" value={d.bankTransferInstructions} onChange={(v) => set("bankTransferInstructions", v)} />
        <Toggle label="Card (Stripe) — requires keys" checked={d.enableCard} onChange={(v) => set("enableCard", v)} />
        <Toggle label="PayPal — requires keys" checked={d.enablePaypal} onChange={(v) => set("enablePaypal", v)} />
      </Card>

      <Card title="Shipping">
        <Text label="Flat shipping fee (base currency)" value={d.flatShipping} onChange={(v) => set("flatShipping", v)} />
        <Text label="Free shipping threshold (blank = none)" value={d.freeShippingThreshold} onChange={(v) => set("freeShippingThreshold", v)} />
      </Card>

      <button onClick={save} disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 font-medium">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input" />
    </div>
  );
}
function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="input" />
    </div>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-ink" />
      {label}
    </label>
  );
}
