"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createRailCollection,
  createRailItem,
  deleteRailCollection,
  deleteRailItem,
  moveRailCollection,
  moveRailItem,
  saveRailSettings,
  updateRailCollection,
  updateRailItem,
} from "@/app/actions/rail";
import { railWord } from "@/lib/rail/word";
import { cn } from "@/lib/utils";

type ProductOption = { id: string; label: string; title: string; draft: boolean };
type Collection = { id: string; name: string; isActive: boolean; count: number };
type Item = {
  id: string;
  productId: string;
  collectionId: string;
  productStatus: string | null;
  productSlug: string | null;
  word: string;
  frontImage: string;
  sideImage: string;
  isActive: boolean;
};
type Settings = { enabled: boolean; placement: string; heading: string };

/** Checkerboard behind the photos, so you can see the background was removed. */
const CHECKER =
  "bg-[length:16px_16px] bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[position:0_0,0_8px,8px_-8px,-8px_0]";

async function uploadRailPhoto(file: File): Promise<{ url: string; removed: boolean }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/upload?purpose=rail", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed.");
  return { url: data.url, removed: data.backgroundRemoved !== false };
}

export function RailAdmin({
  canEditSettings,
  settings,
  placements,
  collections,
  products,
  items,
}: {
  canEditSettings: boolean;
  settings: Settings;
  placements: { key: string; label: string }[];
  collections: Collection[];
  products: ProductOption[];
  items: Item[];
}) {
  // Garments a shopper would see: shown, linked to a product on sale, in a shown collection
  const visible = (c: Collection) =>
    c.isActive ? items.filter((i) => i.collectionId === c.id && i.isActive && i.productId && i.productStatus === "ACTIVE").length : 0;
  const shownCollections = collections.filter((c) => visible(c) >= 2);
  const groups = [
    ...collections.map((c) => ({ key: c.id, title: c.name, hidden: !c.isActive, items: items.filter((i) => i.collectionId === c.id) })),
    { key: "none", title: "Not in a collection", hidden: true, items: items.filter((i) => !collections.some((c) => c.id === i.collectionId)) },
  ].filter((g) => g.items.length > 0);
  return (
    <div className="space-y-6">
      <SettingsCard
        initial={settings}
        placements={placements}
        canEdit={canEditSettings}
        showing={shownCollections.length > 0}
        status={
          shownCollections.length
            ? `Showing: ${shownCollections.map((c) => `${c.name} (${visible(c)})`).join(", ")}`
            : "Not showing yet: a collection needs at least 2 garments that are shown and linked to a product on sale"
        }
      />
      <CollectionsCard collections={collections} visible={visible} />
      <AddCard products={products} collections={collections} />
      <section className="space-y-8">
        <h2 className="font-medium">On the rail ({items.length})</h2>
        {items.length === 0 && <p className="text-sm text-ink-muted">Nothing on the rail yet. Add your first garment above.</p>}
        {groups.map((g) => (
          <div key={g.key} className="space-y-3">
            <h3 className="text-sm font-medium uppercase tracking-wide">
              {g.title} <span className="font-normal normal-case text-ink-muted">({g.items.length})</span>
              {g.key !== "none" && g.hidden && <span className="ml-2 font-normal normal-case text-sale">hidden on the homepage</span>}
              {g.key === "none" && (
                <span className="ml-2 font-normal normal-case text-sale">choose a collection for these, or they won&apos;t show</span>
              )}
            </h3>
            <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {g.items.map((item, i) => (
                <ItemCard key={item.id} item={item} index={i} count={g.items.length} products={products} collections={collections} />
              ))}
            </ol>
          </div>
        ))}
      </section>
    </div>
  );
}

// ── Collections ──────────────────────────────────────────────────────────

function CollectionsCard({ collections, visible }: { collections: Collection[]; visible: (c: Collection) => number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [names, setNames] = useState<Record<string, string>>(Object.fromEntries(collections.map((c) => [c.id, c.name])));
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? null : (res.message ?? "Couldn't save."));
      if (res.ok) after?.();
      router.refresh();
    });
  return (
    <section className={cn("card space-y-4 p-5", pending && "opacity-70")}>
      <div>
        <h2 className="font-medium">Collections</h2>
        <p className="text-sm text-ink-muted">
          The buttons above the rail, in this order. A collection&apos;s button appears on the homepage once it has at
          least 2 garments; empty ones (e.g. Kids&apos; Suits until you add photos) stay out of sight.
        </p>
      </div>
      <ul className="divide-y divide-line-soft">
        {collections.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <input
              aria-label="Collection name"
              value={names[c.id] ?? c.name}
              maxLength={60}
              onChange={(e) => setNames({ ...names, [c.id]: e.target.value })}
              onBlur={() => names[c.id] !== c.name && run(() => updateRailCollection(c.id, { name: names[c.id] }))}
              className="input w-64 py-1.5 text-sm"
            />
            <span className={cn("w-48 text-xs", visible(c) >= 2 ? "text-success" : "text-ink-muted")}>
              {c.count} {c.count === 1 ? "garment" : "garments"}
              {c.isActive ? (visible(c) >= 2 ? " · on the homepage" : " · not shown yet") : " · hidden"}
            </span>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={c.isActive} onChange={(e) => run(() => updateRailCollection(c.id, { isActive: e.target.checked }))} />
              Show
            </label>
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => run(() => moveRailCollection(c.id, -1))} className="btn-ghost px-2 py-1">
              ↑
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={i === collections.length - 1}
              onClick={() => run(() => moveRailCollection(c.id, 1))}
              className="btn-ghost px-2 py-1"
            >
              ↓
            </button>
            {c.count === 0 && (
              <button
                type="button"
                className="ml-auto text-xs text-sale underline"
                onClick={() => confirm(`Delete the collection "${c.name}"?`) && run(() => deleteRailCollection(c.id))}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={newName}
          maxLength={60}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New collection, e.g. Women's Abayas"
          className="input w-72 text-sm"
        />
        <button
          type="button"
          disabled={!newName.trim() || pending}
          className="btn-secondary"
          onClick={() => run(() => createRailCollection(newName), () => setNewName(""))}
        >
          Add collection
        </button>
        {msg && <span className="text-sm text-sale">{msg}</span>}
      </div>
    </section>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────

function SettingsCard({
  initial,
  placements,
  canEdit,
  showing,
  status,
}: {
  initial: Settings;
  placements: { key: string; label: string }[];
  canEdit: boolean;
  showing: boolean;
  status: string;
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">On the homepage</h2>
        <span className={cn("text-sm", initial.enabled && showing ? "text-success" : "text-ink-muted")}>
          {!initial.enabled ? "Hidden (switched off)" : status}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.enabled} disabled={!canEdit} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
          Show the rail on the homepage
        </label>
        <div>
          <label className="label" htmlFor="rail-placement">
            Where on the homepage
          </label>
          <select
            id="rail-placement"
            value={s.placement}
            disabled={!canEdit}
            onChange={(e) => setS({ ...s, placement: e.target.value })}
            className="input"
          >
            {placements.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="rail-heading">
            Heading above the rail (optional)
          </label>
          <input
            id="rail-heading"
            value={s.heading}
            disabled={!canEdit}
            maxLength={80}
            placeholder="e.g. On the rail"
            onChange={(e) => setS({ ...s, heading: e.target.value })}
            className="input"
          />
        </div>
      </div>
      {canEdit ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            className="btn-primary"
            onClick={() =>
              start(async () => {
                const res = await saveRailSettings(s);
                setMsg({ ok: res.ok, text: res.message ?? "" });
                if (res.ok) router.refresh();
              })
            }
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {msg && <span className={cn("text-sm", msg.ok ? "text-success" : "text-sale")}>{msg.text}</span>}
        </div>
      ) : (
        <p className="text-xs text-ink-muted">Only admins can change these settings.</p>
      )}
    </section>
  );
}

// ── Add a garment ────────────────────────────────────────────────────────

function AddCard({ products, collections }: { products: ProductOption[]; collections: Collection[] }) {
  const router = useRouter();
  const [collectionId, setCollectionId] = useState(collections[0]?.id ?? "");
  const [front, setFront] = useState<string | null>(null);
  const [side, setSide] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [word, setWord] = useState("");
  const [added, setAdded] = useState(0); // clears the product search after each add
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const autoWord = railWord("", products.find((p) => p.id === productId)?.title);

  return (
    <section className="card space-y-4 p-5">
      <h2 className="font-medium">Add a garment</h2>
      <p className="text-sm text-ink-muted">
        Photos: the garment on a hanger, hook at the top centre, on a plain white background, portrait (4:5), PNG or
        JPG. Use the same hanger and framing for every garment so the hooks line up on the bar.
      </p>
      <div className="grid gap-5 md:grid-cols-[auto_auto_1fr]">
        <PhotoBox label="Front view" url={front} onUploaded={setFront} />
        <PhotoBox label="Side view" url={side} onUploaded={setSide} />
        <div className="space-y-4">
          <CollectionPicker collections={collections} value={collectionId} onChange={setCollectionId} />
          <ProductPicker key={added} products={products} value={productId} onChange={setProductId} />
          <WordField value={word} onChange={setWord} placeholder={autoWord} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || !front || !side}
              className="btn-primary"
              onClick={() =>
                start(async () => {
                  const res = await createRailItem({ frontImage: front, sideImage: side, productId, collectionId, word });
                  setMsg({ ok: res.ok, text: res.message ?? "" });
                  if (res.ok) {
                    setFront(null);
                    setSide(null);
                    setProductId("");
                    setWord("");
                    setAdded((n) => n + 1);
                    router.refresh();
                  }
                })
              }
            >
              {pending ? "Adding…" : "Add to the rail"}
            </button>
            {(!front || !side) && <span className="text-xs text-ink-muted">Upload both photos first.</span>}
            {msg && <span className={cn("text-sm", msg.ok ? "text-success" : "text-sale")}>{msg.text}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── One garment on the rail ──────────────────────────────────────────────

function ItemCard({
  item,
  index,
  count,
  products,
  collections,
}: {
  item: Item;
  index: number;
  count: number;
  products: ProductOption[];
  collections: Collection[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [word, setWord] = useState(item.word);
  const [error, setError] = useState<string | null>(null);
  const autoWord = railWord("", products.find((p) => p.id === item.productId)?.title);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.message ?? "Couldn't save.");
      router.refresh();
    });

  const problem = !collections.some((c) => c.id === item.collectionId)
    ? "Not in a collection, so it isn't shown on the homepage."
    : !item.productId
    ? "Not linked to a product, so it isn't shown on the homepage."
    : item.productStatus !== "ACTIVE"
      ? "The linked product isn't on sale (draft or archived), so it isn't shown."
      : !item.isActive
        ? "Hidden from the homepage."
        : null;

  return (
    <li className={cn("card space-y-3 p-4", pending && "opacity-60")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-ink-muted">#{index + 1}</span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Move left" disabled={index === 0 || pending} onClick={() => run(() => moveRailItem(item.id, -1))} className="btn-ghost px-2 py-1 text-sm">
            ←
          </button>
          <button type="button" aria-label="Move right" disabled={index === count - 1 || pending} onClick={() => run(() => moveRailItem(item.id, 1))} className="btn-ghost px-2 py-1 text-sm">
            →
          </button>
        </div>
      </div>
      <div className="flex gap-3">
        <PhotoBox label="Front" url={item.frontImage} small onUploaded={(url) => run(() => updateRailItem(item.id, { frontImage: url }))} />
        <PhotoBox label="Side" url={item.sideImage} small onUploaded={(url) => run(() => updateRailItem(item.id, { sideImage: url }))} />
      </div>
      <CollectionPicker
        collections={collections}
        value={item.collectionId}
        onChange={(id) => run(() => updateRailItem(item.id, { collectionId: id }))}
      />
      <ProductPicker products={products} value={item.productId} onChange={(id) => run(() => updateRailItem(item.id, { productId: id }))} />
      <WordField
        value={word}
        onChange={setWord}
        placeholder={autoWord}
        onBlur={() => word !== item.word && run(() => updateRailItem(item.id, { word }))}
      />
      {problem && <p className="text-xs text-sale">{problem}</p>}
      {error && <p className="text-xs text-sale">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={item.isActive} disabled={pending} onChange={(e) => run(() => updateRailItem(item.id, { isActive: e.target.checked }))} />
          Show on the homepage
        </label>
        {item.productSlug && (
          <a href={`/products/${item.productSlug}`} target="_blank" rel="noreferrer" className="text-ink-muted underline">
            Product page
          </a>
        )}
        <button
          type="button"
          disabled={pending}
          className="ml-auto text-sale underline"
          onClick={() => confirm("Remove this garment and its two photos from the rail?") && run(() => deleteRailItem(item.id))}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function PhotoBox({ label, url, onUploaded, small }: { label: string; url: string | null; onUploaded: (url: string) => void; small?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className={small ? "w-28" : "w-40"}>
      <p className="label">{label}</p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn("relative block w-full overflow-hidden border border-line", CHECKER, small ? "aspect-[4/5]" : "aspect-[4/5]")}
        aria-label={url ? `Replace ${label.toLowerCase()} photo` : `Upload ${label.toLowerCase()} photo`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-ink-muted">
            {busy ? "Uploading…" : "+ Upload"}
          </span>
        )}
        {url && busy && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs">Uploading…</span>}
      </button>
      {url && !busy && (
        <button type="button" onClick={() => input.current?.click()} className="mt-1 text-xs text-ink-muted underline">
          Replace
        </button>
      )}
      {note && <p className={cn("mt-1 text-xs", note.ok ? "text-ink-muted" : "text-sale")}>{note.text}</p>}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setNote(null);
          try {
            const res = await uploadRailPhoto(file);
            onUploaded(res.url);
            if (!res.removed) setNote({ ok: false, text: "The background isn't plain, so it was kept. Use a photo on plain white." });
          } catch (err) {
            setNote({ ok: false, text: err instanceof Error ? err.message : "Upload failed." });
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function CollectionPicker({ collections, value, onChange }: { collections: Collection[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="label">Collection</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input text-sm">
        <option value="">Choose a collection…</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ProductPicker({ products, value, onChange }: { products: ProductOption[]; value: string; onChange: (id: string) => void }) {
  const [filter, setFilter] = useState("");
  const options = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? products.filter((p) => p.label.toLowerCase().includes(q)) : products;
    const selected = products.find((p) => p.id === value);
    return selected && !list.includes(selected) ? [selected, ...list] : list;
  }, [products, filter, value]);
  return (
    <div className="space-y-1">
      <label className="label">Product it opens</label>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search by name or SKU…" className="input text-sm" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input text-sm">
        <option value="">Choose a product…</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
            {p.draft ? " (draft)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function WordField({ value, onChange, placeholder, onBlur }: { value: string; onChange: (v: string) => void; placeholder: string; onBlur?: () => void }) {
  return (
    <div className="space-y-1">
      <label className="label">Big word behind the rail</label>
      <input
        value={value}
        maxLength={20}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={`Automatic: ${placeholder.toUpperCase()}`}
        className="input text-sm uppercase placeholder:normal-case"
      />
    </div>
  );
}
