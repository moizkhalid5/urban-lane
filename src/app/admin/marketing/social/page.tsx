import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { clearScheduled, packSummary, previewPack } from "@/lib/social/pack";

export const dynamic = "force-dynamic";

const DEFAULT_HASHTAGS = "#UrbanLane #UKBrands #PakistanFashion #OnlineShoppingPakistan";
const DEFAULT_TIMES = "13:00, 18:00, 21:00";

async function clearHistory() {
  "use server";
  await requireAdmin();
  await clearScheduled();
  revalidatePath("/admin/marketing/social");
}

/**
 * Admin → Marketing → Social pack: download a CSV of product posts for a scheduler such as Publer, which then
 * posts them to Instagram/Facebook on the dates set here. Products in a downloaded pack are remembered, so the
 * next pack continues with the rest of the catalogue.
 */
export default async function SocialPackPage() {
  await requireAdmin();
  const tomorrow = new Date(Date.now() + 5 * 3600_000 + 86400_000).toISOString().slice(0, 10);
  const [summary, preview] = await Promise.all([
    packSummary(),
    previewPack({ start: tomorrow, days: 1, times: ["13:00", "18:00", "21:00"], photos: 1, order: "sale", mix: true, hashtags: DEFAULT_HASHTAGS, includeScheduled: false }),
  ]);
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/admin/marketing" className="text-sm text-ink-muted hover:text-ink">← Marketing</Link>
        <h1 className="mt-2 text-2xl font-medium">Social pack</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          Download your products as ready-made Instagram and Facebook posts, a few a day, for a scheduler such as{" "}
          <strong>Publer</strong> (Bulk Uploader → CSV). Each post has the product&apos;s photos as Instagram-ready pictures and a
          caption with its live price, sale price and sizes. Products in a downloaded pack are remembered, so the next pack carries on
          with the rest.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat value={summary.remaining} label="products not yet in a pack" />
        <Stat value={summary.scheduled} label="already in a pack" />
        <Stat value={summary.ready} label="products that can be posted (live, in stock, with photos)" />
      </section>
      {summary.last && <p className="-mt-3 text-xs text-ink-muted">The last pack runs until {fmt(summary.last)}.</p>}

      <form action="/api/admin/social-pack" method="post" className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="First day" hint="Pakistan time">
          <input type="date" name="start" defaultValue={tomorrow} className="input" required />
        </Field>
        <Field label="Number of days" hint="30 days at 3 a day = 90 posts (500 at most per file)">
          <input type="number" name="days" defaultValue={30} min={1} max={500} className="input" />
        </Field>
        <Field label="Posting times" hint="Pakistan time, separated by commas">
          <input name="times" defaultValue={DEFAULT_TIMES} className="input" />
        </Field>
        <Field label="Photos per post" hint="1 = single photo; 2 or more = a swipeable carousel (some Publer plans allow only 1)">
          <select name="photos" defaultValue="1" className="input">
            <option value="1">1 photo</option>
            <option value="3">Up to 3 photos</option>
            <option value="5">Up to 5 photos</option>
          </select>
        </Field>
        <Field label="Which products first">
          <select name="order" defaultValue="sale" className="input">
            <option value="sale">Biggest discount first</option>
            <option value="newest">Newest first</option>
            <option value="popular">Best sellers first</option>
          </select>
        </Field>
        <Field label="Hashtags" hint="The brand and department are added to each post">
          <input name="hashtags" defaultValue={DEFAULT_HASHTAGS} className="input" />
        </Field>
        <div className="space-y-2 text-sm sm:col-span-2">
          <Check name="mix" defaultChecked label="Mix departments (women, men, kids, beauty) instead of many of one kind in a row" />
          <Check name="remember" defaultChecked label="Remember these products, so the next pack starts with different ones" />
          <Check name="includeScheduled" label="Include products already in a pack" />
        </div>
        <div className="sm:col-span-2">
          <button className="btn-primary">Download the pack (CSV)</button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">What the first posts look like</h2>
        {preview.length === 0 ? (
          <p className="text-sm text-ink-muted">Every product is already in a pack.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {preview.map((p) => (
              <div key={p.product.id} className="card overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element -- the exact picture the scheduler will post */}
                <img src={p.photos[0].path} alt={p.photos[0].alt} className="aspect-[4/5] w-full bg-line-soft object-cover" />
                <div className="p-4">
                  <p className="text-xs text-ink-muted">{p.slot.label} · {p.labels || "—"}</p>
                  <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">{p.caption}</pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card space-y-2 p-5 text-sm">
        <h2 className="text-base font-medium">Using it with Publer</h2>
        <ol className="list-decimal space-y-1 pl-5 text-ink-soft">
          <li>In Publer, connect your Instagram (and Facebook Page) and set the workspace time zone to Pakistan (Asia/Karachi).</li>
          <li>Download a pack here, then in Publer open <strong>Create → Bulk Uploader → CSV</strong> and upload the file as it is (don&apos;t open it in Excel first).</li>
          <li>Choose your Instagram account, check a few posts, and schedule them.</li>
        </ol>
        <p className="text-ink-muted">
          Captions use today&apos;s prices: the 11.11 price on posts during the sale, the regular price after it. When prices or stock change a lot,
          clear the history below and download a fresh pack.
        </p>
        <form action={clearHistory}>
          <button className="text-sm text-sale underline underline-offset-4">Clear the history (start the catalogue again)</button>
        </form>
      </section>
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-2">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <span>{label}</span>
    </label>
  );
}
