import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { approveDraft, draftSummary, importDrafts, listDrafts, skipDraft, undoDraft } from "@/lib/descriptions/drafts";
import { plainText } from "@/lib/seo/copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Product descriptions — Urban Lane admin" };

const PATH = "/admin/products/descriptions";

/* ---------- server actions ---------- */

async function upload(form: FormData) {
  "use server";
  await requireAdmin();
  const file = form.get("file");
  let msg: string;
  try {
    if (!(file instanceof File) || !file.size) throw new Error("Choose the batch file first.");
    if (file.size > 900_000) throw new Error("That file is too big for a batch.");
    const r = await importDrafts(JSON.parse(await file.text()));
    msg = `${r.added} new description${r.added === 1 ? "" : "s"} to review${r.unchanged ? `, ${r.unchanged} already here` : ""}${
      r.unknown.length ? `; ${r.unknown.length} didn't match a product (${r.unknown.slice(0, 3).join(", ")}${r.unknown.length > 3 ? "…" : ""})` : ""
    }.`;
  } catch (e) {
    msg = e instanceof SyntaxError ? "That isn't a batch file (it couldn't be read)." : e instanceof Error ? e.message : "Couldn't load the file.";
  }
  redirect(`${PATH}?msg=${encodeURIComponent(msg)}`);
}

async function approve(form: FormData) {
  "use server";
  await requireAdmin();
  await approveDraft(String(form.get("productId")), String(form.get("text") ?? ""), String(form.get("details") ?? ""));
  revalidatePath(PATH);
}

async function skip(form: FormData) {
  "use server";
  await requireAdmin();
  await skipDraft(String(form.get("productId")));
  revalidatePath(PATH);
}

async function undo(form: FormData) {
  "use server";
  await requireAdmin();
  await undoDraft(String(form.get("productId")));
  revalidatePath(PATH);
}

/** Approves every draft shown, as written (the shop owner has read them on this page). */
async function approveShown(form: FormData) {
  "use server";
  await requireAdmin();
  const ids = form.getAll("productId").map(String);
  const drafts = await listDrafts("pending", 200);
  for (const d of drafts.filter((x) => ids.includes(x.productId))) await approveDraft(d.productId, d.proposed);
  redirect(`${PATH}?msg=${encodeURIComponent(`${ids.length} descriptions approved and live.`)}`);
}

/* ---------- page ---------- */

/**
 * Admin → Products → Descriptions: new product descriptions (written outside the shop and loaded as a batch
 * file) side by side with what the product says now. Nothing changes on the shop until a description is
 * approved here; approvals can be undone. Lib: lib/descriptions/drafts.ts.
 */
export default async function DescriptionsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const [summary, pending, approved] = await Promise.all([draftSummary(), listDrafts("pending", 30), listDrafts("approved", 10)]);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-ink-muted hover:text-ink">
          ← Products
        </Link>
        <h1 className="mt-2 text-2xl font-medium">Product descriptions</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          New descriptions and Details lists wait here for your OK. Read each one next to what the product says now, edit it if
          you like, then approve it: it goes live on the product page and in Google straight away. Nothing changes until you
          approve, and an approval can be undone.
        </p>
      </div>

      {msg && <p className="border border-success/30 bg-success/5 px-4 py-3 text-sm">{msg}</p>}

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat value={summary.pending} label="waiting for your OK" />
        <Stat value={summary.approved} label="approved and live" />
        <Stat value={summary.thin} label={`live products with a short or no description (of ${summary.live})`} />
        <Stat value={summary.skipped} label="skipped" />
      </section>

      <form action={upload} className="card flex flex-wrap items-end gap-4 p-5">
        <label className="block text-sm">
          <span className="font-medium">Load a batch</span>
          <span className="mt-0.5 block text-xs text-ink-muted">The .json file of new descriptions</span>
          <input type="file" name="file" accept=".json,application/json" className="mt-2 block text-sm" required />
        </label>
        <button className="btn-secondary">Load for review</button>
      </form>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-medium">
            Waiting for your OK {summary.pending > pending.length && <span className="text-sm font-normal text-ink-muted">(first {pending.length} of {summary.pending})</span>}
          </h2>
          {pending.length > 1 && (
            <form action={approveShown}>
              {pending.map((d) => (
                <input key={d.productId} type="hidden" name="productId" value={d.productId} />
              ))}
              <button className="text-sm underline underline-offset-4">Approve all {pending.length} below as written</button>
            </form>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="card p-6 text-sm text-ink-muted">Nothing waiting. Load the next batch above.</p>
        ) : (
          pending.map((d) => {
            const now = plainText(d.product.description);
            return (
              <form key={d.productId} action={approve} className="card grid gap-5 p-5 md:grid-cols-[96px_minmax(0,1fr)_minmax(0,1.6fr)]">
                <input type="hidden" name="productId" value={d.productId} />
                <div className="relative h-24 w-24 overflow-hidden bg-line-soft">
                  {d.product.images[0] && <Image src={d.product.images[0].url} alt="" fill sizes="96px" className="object-cover" />}
                </div>
                <div className="min-w-0 text-sm">
                  <a href={`/products/${d.product.slug}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                    {d.product.title} ↗
                  </a>
                  {d.product.brand && <p className="text-xs text-ink-muted">{d.product.brand.name}</p>}
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-muted">Now</p>
                  <p className="mt-1 line-clamp-6 whitespace-pre-line text-ink-soft">{now || <em className="text-ink-muted">No description</em>}</p>
                  {d.product.details && (
                    <>
                      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-muted">Details now</p>
                      <p className="mt-1 line-clamp-4 whitespace-pre-line text-xs text-ink-muted">{d.product.details}</p>
                    </>
                  )}
                </div>
                <div className="flex min-w-0 flex-col">
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-muted" htmlFor={`t-${d.productId}`}>
                    New description
                  </label>
                  <textarea id={`t-${d.productId}`} name="text" defaultValue={d.proposed} rows={10} className="input mt-1 text-sm leading-relaxed" />
                  <label className="mt-4 text-xs font-medium uppercase tracking-wide text-ink-muted" htmlFor={`d-${d.productId}`}>
                    New details <span className="font-normal normal-case tracking-normal">(one point per line; leave empty to keep the current details)</span>
                  </label>
                  <textarea
                    id={`d-${d.productId}`}
                    name="details"
                    defaultValue={d.details ?? ""}
                    rows={Math.min(10, Math.max(4, (d.details ?? "").split("\n").length + 1))}
                    className="input mt-1 text-sm leading-relaxed"
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <button className="btn-primary">Approve</button>
                    <button formAction={skip} className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink">
                      Skip
                    </button>
                  </div>
                </div>
              </form>
            );
          })
        )}
      </section>

      {approved.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Recently approved</h2>
          <ul className="card divide-y divide-line-soft">
            {approved.map((d) => (
              <li key={d.productId} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <a href={`/products/${d.product.slug}`} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:underline">
                  {d.product.title} ↗
                </a>
                <form action={undo}>
                  <input type="hidden" name="productId" value={d.productId} />
                  <button className="shrink-0 text-ink-muted underline underline-offset-4 hover:text-ink">Undo</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString("en-GB")}</p>
      <p className="mt-0.5 text-sm text-ink-muted">{label}</p>
    </div>
  );
}
