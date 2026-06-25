"use client";

import { useState, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { saveAddress, deleteAddress, type ActionResult } from "@/app/actions/account";

export type AddressDTO = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

const init: ActionResult = { ok: false, message: "" };

export function AddressBook({ addresses }: { addresses: AddressDTO[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AddressDTO | "new" | null>(null);
  const [state, action, pending] = useActionState(saveAddress, init);

  useEffect(() => {
    if (state.ok) {
      setEditing(null);
      router.refresh();
    }
  }, [state.ok, router]);

  async function onDelete(id: string) {
    await deleteAddress(id);
    router.refresh();
  }

  if (editing) {
    const a = editing === "new" ? null : editing;
    return (
      <form action={action} className="max-w-lg space-y-4 border border-line p-6">
        <h3 className="text-lg font-medium">{a ? "Edit address" : "Add address"}</h3>
        {state.message && !state.ok && <p className="text-sm text-sale">{state.message}</p>}
        {a && <input type="hidden" name="id" value={a.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="firstName" label="First name" defaultValue={a?.firstName} required />
          <Input name="lastName" label="Last name" defaultValue={a?.lastName} required />
          <Input name="phone" label="Phone" defaultValue={a?.phone ?? ""} />
          <Input name="country" label="Country code" defaultValue={a?.country ?? "PK"} required />
          <div className="sm:col-span-2"><Input name="line1" label="Address" defaultValue={a?.line1} required /></div>
          <div className="sm:col-span-2"><Input name="line2" label="Apartment, etc." defaultValue={a?.line2 ?? ""} /></div>
          <Input name="city" label="City" defaultValue={a?.city} required />
          <Input name="state" label="State/Province" defaultValue={a?.state ?? ""} />
          <Input name="postalCode" label="Postal code" defaultValue={a?.postalCode} required />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isDefault" defaultChecked={a?.isDefault} className="h-4 w-4 accent-ink" />
          Set as default address
        </label>
        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Saving…" : "Save address"}
          </button>
          <button type="button" onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Saved addresses</h2>
        <button onClick={() => setEditing("new")} className="btn-secondary">Add new</button>
      </div>

      {addresses.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-ink-muted">
          No saved addresses yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="border border-line p-4 text-sm">
              {a.isDefault && (
                <span className="mb-2 inline-block bg-ink px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
                  Default
                </span>
              )}
              <p className="font-medium">{a.firstName} {a.lastName}</p>
              <p className="text-ink-soft">
                {a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />
                {a.city}{a.state ? `, ${a.state}` : ""} {a.postalCode}<br />
                {a.country}{a.phone ? ` · ${a.phone}` : ""}
              </p>
              <div className="mt-3 flex gap-3">
                <button onClick={() => setEditing(a)} className="text-ink-muted underline hover:text-ink">Edit</button>
                <button onClick={() => onDelete(a.id)} className="text-ink-muted underline hover:text-ink">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Input({ name, label, defaultValue, required }: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={defaultValue} required={required} className="input" />
    </div>
  );
}
