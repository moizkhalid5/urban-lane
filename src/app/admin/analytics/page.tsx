import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getBaseCurrency } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { RANGES, reportRange, shopTodayIso, type ReportRange } from "@/lib/analytics/ranges";
import { storeReport } from "@/lib/analytics/store-report";
import { getReportAccess } from "@/lib/analytics/settings";
import { gaRealtime, gaReport } from "@/lib/analytics/ga-data";
import { clarityLinks, clarityReport } from "@/lib/analytics/clarity-data";
import { heatmapPages } from "@/lib/analytics/heatmap";
import { ChartCard } from "@/components/admin/analytics/ChartCard";
import { HeatmapViewer } from "@/components/admin/analytics/HeatmapViewer";
import { BarList, ChangeTable, ConnectCard, Funnel, KpiTile, NeedsGa, Panel, SourceError, SplitBar, StatTile } from "@/components/admin/analytics/ReportParts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics — Urban Lane admin" };

const count = new Intl.NumberFormat("en-PK");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const longDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const span = (p: { from: string; to: string }) => (p.from === p.to ? longDate(p.from) : `${longDate(p.from)} – ${longDate(p.to)}`);
const ago = (d: Date) => {
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : `${Math.round(min / 60)} h ago`;
};
const seconds = (s: number | null) => (s === null ? "—" : s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`);

const PAYMENT_LABELS: Record<string, string> = {
  COD: "Cash on delivery",
  EASYPAISA: "Easypaisa",
  JAZZCASH: "JazzCash",
  BANK_TRANSFER: "Bank transfer",
};
const FULFILMENT_LABELS: Record<string, string> = {
  UNFULFILLED: "Unfulfilled",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

const settle = <T,>(p: Promise<T> | null) =>
  p ? p.then((value) => ({ value, error: null as string | null })).catch((e: unknown) => ({ value: null, error: e instanceof Error ? e.message : "Unknown error" })) : null;

type Search = { range?: string; from?: string; to?: string };

/**
 * Admin → Analytics, laid out like Shopify's: the shop's own sales (always exact), Google Analytics (visits,
 * funnel, traffic) and Microsoft Clarity (behaviour) once connected in Admin → Settings, and the shop's own
 * click and scroll heatmaps.
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaff();
  const sp = await searchParams;
  const range = reportRange(sp.range, new Date(), { from: sp.from, to: sp.to });
  const [currency, access, store, pages] = await Promise.all([
    getBaseCurrency(),
    getReportAccess(),
    storeReport(range),
    heatmapPages(range.current.from, range.current.to).catch(() => []),
  ]);

  const gaOn = !!(access.gaKey && access.gaPropertyId);
  const clarityOn = !!(access.clarityToken && access.clarityProjectId);
  const [ga, live, clarity] = await Promise.all([
    settle(gaOn ? gaReport(access.gaKey!, access.gaPropertyId!, range) : null),
    settle(gaOn ? gaRealtime(access.gaKey!, access.gaPropertyId!) : null),
    settle(clarityOn ? clarityReport(access.clarityProjectId!, access.clarityToken!) : null),
  ]);
  const g = ga?.value?.data ?? null;
  const c = clarity?.value?.data ?? null;
  const liveNow = live?.value?.data ?? null;
  const money = (cents: number) => formatMoney(cents, currency);
  const rate = (orders: number, sessions: number) => (sessions ? orders / sessions : null);

  const b = store.breakdown;
  const pb = store.previousBreakdown;
  const days = store.byDay;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {span(range.current)}, compared with {span(range.previous)} · Pakistan time
          </p>
        </div>
        {liveNow !== null && (
          <p className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
            <span className="font-semibold">{count.format(liveNow)}</span>
            <span className="text-ink-muted">{liveNow === 1 ? "visitor" : "visitors"} right now</span>
          </p>
        )}
      </div>

      <RangePicker range={range} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiTile
          label="Total sales"
          value={money(store.current.salesCents)}
          now={store.current.salesCents}
          before={store.previous.salesCents}
          spark={days.map((d) => d.cents)}
        />
        <KpiTile label="Orders" value={count.format(store.current.orders)} now={store.current.orders} before={store.previous.orders} spark={days.map((d) => d.orders)} />
        <KpiTile
          label="Average order value"
          value={money(store.current.aovCents)}
          now={store.current.aovCents}
          before={store.previous.aovCents}
          spark={days.map((d) => (d.orders ? d.cents / d.orders : 0))}
        />
        <KpiTile
          label="Sessions"
          value={g ? count.format(g.sessions) : "—"}
          now={g?.sessions ?? null}
          before={g?.previousSessions ?? null}
          hint={g ? undefined : "Connect Google Analytics"}
          spark={g ? g.sessionsByDay.map((d) => d.sessions) : undefined}
        />
        <KpiTile
          label="Conversion rate"
          value={g ? pct(rate(store.current.orders, g.sessions)) : "—"}
          now={g ? rate(store.current.orders, g.sessions) : null}
          before={g ? rate(store.previous.orders, g.previousSessions) : null}
          points
          hint={g ? "orders ÷ sessions" : "needs sessions"}
          spark={g ? g.sessionsByDay.map((d, i) => (d.sessions ? (days[i]?.orders ?? 0) / d.sessions : 0)) : undefined}
        />
        <KpiTile
          label="Returning customer rate"
          value={pct(store.current.returningRate)}
          now={store.current.returningRate}
          before={store.previous.returningRate}
          points
          hint={`${count.format(store.current.customers)} ${store.current.customers === 1 ? "customer" : "customers"}`}
        />
      </div>

      <ChartCard
        currentLabel={span(range.current)}
        previousLabel={span(range.previous)}
        series={[
          {
            key: "sales",
            tab: "Total sales over time",
            unit: currency.symbol,
            points: days.map((d) => ({ date: d.date, previousDate: d.previousDate, current: d.cents / 100, previous: d.previousCents / 100 })),
          },
          {
            key: "orders",
            tab: "Orders over time",
            points: days.map((d) => ({ date: d.date, previousDate: d.previousDate, current: d.orders, previous: d.previousOrders })),
          },
          {
            key: "sessions",
            tab: "Sessions over time",
            unavailable: g ? undefined : "Connect Google Analytics in Settings to see sessions",
            points: g
              ? g.sessionsByDay.map((d, i) => ({ date: d.date, previousDate: range.previous.days[i] ?? null, current: d.sessions, previous: d.previousSessions }))
              : [],
          },
        ]}
      />
      {ga?.value?.stale && <SourceError source="Google Analytics" message="Google didn't answer just now." saved />}
      {ga?.error && <SourceError source="Google Analytics" message={ga.error} />}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Total sales breakdown">
          <ChangeTable
            format={money}
            rows={[
              { label: "Gross sales", now: b.grossCents, before: pb.grossCents },
              { label: "Discounts", now: b.discountCents, before: pb.discountCents, lowerIsBetter: true, negative: true },
              { label: "Shipping charges", now: b.shippingCents, before: pb.shippingCents },
              ...(b.taxCents || pb.taxCents ? [{ label: "Taxes", now: b.taxCents, before: pb.taxCents }] : []),
              { label: "Total sales", now: b.totalCents, before: pb.totalCents, total: true },
            ]}
          />
          <p className="mt-3 text-xs text-ink-muted">
            {count.format(b.items)} {b.items === 1 ? "item" : "items"} sold in {count.format(store.current.orders)} {store.current.orders === 1 ? "order" : "orders"}.
            Cancelled, returned, refunded and failed orders aren&apos;t counted.
          </p>
        </Panel>

        <Panel title="From visit to purchase" note={g ? "visitors who did each step" : undefined}>
          {g ? (
            <Funnel
              steps={[
                { label: "Visited the shop", value: g.funnel.visitors },
                { label: "Viewed a product", value: g.funnel.viewedProduct },
                { label: "Added to bag", value: g.funnel.addedToBag },
                { label: "Started checkout", value: g.funnel.checkout },
                { label: "Ordered", value: g.funnel.purchased },
              ]}
            />
          ) : (
            <NeedsGa />
          )}
        </Panel>

        <Panel title="Top products by sales">
          <BarList
            rows={store.topProducts.slice(0, 6).map((p) => ({ name: p.title, value: p.cents, extra: `${count.format(p.units)} sold` }))}
            format={money}
            empty="No orders in this period."
          />
          <p className="mt-3 text-xs text-ink-muted">
            Before discounts.{" "}
            <Link href="/admin/products" className="underline">
              Manage products
            </Link>
          </p>
        </Panel>

        <Panel title="Sales by category">
          <BarList
            rows={store.byCategory.slice(0, 6).map((c) => ({ name: c.name, value: c.cents, extra: `${count.format(c.units)} sold` }))}
            format={money}
            empty="No orders in this period."
          />
        </Panel>

        <Panel title="Sessions by traffic source">{g ? <BarList rows={g.channels} /> : <NeedsGa />}</Panel>
        <Panel title="Sessions by device">{g ? <SplitBar rows={g.devices} /> : <NeedsGa />}</Panel>
        <Panel title="Sessions by country">{g ? <BarList rows={g.countries.slice(0, 6)} /> : <NeedsGa />}</Panel>

        <Panel title="Sales by city">
          <BarList rows={store.byCity.slice(0, 6).map((c) => ({ name: c.name, value: c.cents, extra: `${count.format(c.orders)} ${c.orders === 1 ? "order" : "orders"}` }))} format={money} empty="No orders in this period." />
          <p className="mt-3 text-xs text-ink-muted">From the delivery address on each order.</p>
        </Panel>

        <Panel title="Top referrers">{g ? <BarList rows={g.sources.slice(0, 6)} /> : <NeedsGa />}</Panel>
        <Panel title="Top landing pages" note={g ? "first page of a visit" : undefined}>
          {g ? <BarList rows={g.landingPages.slice(0, 6)} link={(path) => (path.startsWith("/") ? path : null)} /> : <NeedsGa />}
        </Panel>

        <Panel title="Orders to fulfil" note="orders placed in this period, by where they are now">
          <BarList
            rows={store.fulfilment
              .filter((f) => f.orders || !["CANCELLED", "RETURNED"].includes(f.status))
              .map((f) => ({ name: FULFILMENT_LABELS[f.status] ?? f.status, value: f.orders }))}
            empty="No orders in this period."
          />
          <p className="mt-3 text-xs">
            <Link href="/admin/orders" className="underline">
              Go to orders
            </Link>
          </p>
        </Panel>

        <Panel title="Visitors">{g ? <SplitBar rows={g.visitorTypes ?? []} /> : <NeedsGa />}</Panel>

        <Panel title="Sales by payment method">
          <BarList
            rows={store.byPayment.map((p) => ({ name: PAYMENT_LABELS[p.method] ?? p.method, value: p.cents, extra: `${count.format(p.orders)} ${p.orders === 1 ? "order" : "orders"}` }))}
            format={money}
            empty="No orders in this period."
          />
        </Panel>

        <Panel title="Top searches" note={g ? "what shoppers typed in search" : undefined}>
          {g ? <BarList rows={g.searches.slice(0, 6)} empty="No searches in this period yet." /> : <NeedsGa what="searches" />}
        </Panel>

        <Panel title="Most viewed products" note={g ? "views → added to bag → ordered" : undefined} className="lg:col-span-2">
          {!g ? (
            <NeedsGa what="product views" />
          ) : g.products.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-muted">
                <tr>
                  <th className="pb-2 font-normal">Product</th>
                  <th className="w-20 pb-2 text-right font-normal">Views</th>
                  <th className="w-20 pb-2 text-right font-normal">To bag</th>
                  <th className="w-20 pb-2 text-right font-normal">Ordered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {g.products.map((p) => (
                  <tr key={p.name}>
                    <td className="max-w-0 truncate py-2 pr-3">{p.name}</td>
                    <td className="py-2 text-right tabular-nums">{count.format(p.views)}</td>
                    <td className="py-2 text-right tabular-nums">{count.format(p.addedToBag)}</td>
                    <td className="py-2 text-right tabular-nums">{count.format(p.purchased)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-sm text-ink-muted">No product views recorded for this period yet.</p>
          )}
        </Panel>
      </div>

      {/* Heatmaps: the shop's own click and scroll maps. */}
      <section className="card space-y-4 p-5" id="heatmaps">
        <div>
          <h2 className="text-lg font-semibold">Heatmaps</h2>
          <p className="text-sm text-ink-muted">
            Where shoppers click and how far down they scroll, on each page, for {span(range.current)}. Recorded by
            Urban Lane itself from visitors who allow analytics; your team&apos;s own visits aren&apos;t counted.
          </p>
        </div>
        <HeatmapViewer pages={pages} from={range.current.from} to={range.current.to} />
      </section>

      {/* Behaviour, from Clarity. */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Shopper behaviour</h2>
            <p className="text-sm text-ink-muted">
              Microsoft Clarity · always the last 3 days{clarity?.value ? ` · updated ${ago(clarity.value.fetchedAt)}` : ""}
            </p>
          </div>
          {access.clarityProjectId && (
            <div className="flex flex-wrap gap-2 text-sm">
              {(["recordings", "heatmaps", "dashboard"] as const).map((k) => (
                <a key={k} href={clarityLinks(access.clarityProjectId!)[k]} target="_blank" rel="noreferrer" className="btn-secondary capitalize">
                  Clarity {k} ↗
                </a>
              ))}
            </div>
          )}
        </div>
        {clarity?.value?.stale && <SourceError source="Clarity" message="Clarity didn't answer just now." saved />}
        {c ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Sessions" value={c.sessions === null ? "—" : count.format(c.sessions)} hint={c.botSessions ? `+${count.format(c.botSessions)} bots left out` : undefined} />
              <StatTile label="Pages per session" value={c.pagesPerSession === null ? "—" : c.pagesPerSession.toFixed(2)} />
              <StatTile label="Average scroll depth" value={c.scrollDepth === null ? "—" : `${Math.round(c.scrollDepth)}%`} />
              <StatTile label="Active time" value={seconds(c.activeSeconds)} hint={c.totalSeconds !== null ? `of ${seconds(c.totalSeconds)} on the page` : undefined} />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Frustration signals" note="share of sessions">
                <ul className="divide-y divide-line-soft">
                  {c.signals.map((s) => (
                    <li key={s.key} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium">{s.label}</p>
                        <p className="text-xs text-ink-muted">{s.help}</p>
                      </div>
                      <span className="shrink-0 tabular-nums font-semibold">{s.sessionsPct === null ? "—" : `${s.sessionsPct.toFixed(1)}%`}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-muted">Watch these sessions in Clarity&apos;s Recordings, filtered by the signal, to see what went wrong.</p>
              </Panel>
              <Panel title="Most visited pages" note="last 3 days">
                <BarList rows={c.pages.map((p) => ({ name: p.name.replace(/^https?:\/\/[^/]+/, "") || "/", value: p.value }))} />
              </Panel>
            </div>
          </>
        ) : clarity?.error ? (
          <SourceError source="Clarity" message={clarity.error} />
        ) : (
          <ConnectCard title="Connect Clarity to see how shoppers behave">
            <p>
              Rage clicks, dead clicks, quick backs, scroll depth and time on page show here once a Clarity API token is
              saved in Settings → Reports in the admin. Session recordings stay on the Clarity website.
            </p>
          </ConnectCard>
        )}
      </div>

      <p className="text-xs text-ink-muted">
        Sales, orders and customers come from your orders and are exact. Sessions, the funnel and traffic come from Google
        Analytics, which misses visitors who block it or reject cookies, so its figures run a little low
        {g && ga?.value ? ` (updated ${ago(ga.value.fetchedAt)})` : ""}.
      </p>
    </div>
  );
}

/** Date range: one row of presets, plus Custom (two dates), above everything it scopes. */
function RangePicker({ range }: { range: ReportRange }) {
  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
      active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink",
    );
  return (
    <div className="flex flex-wrap items-start gap-2">
      <nav className="contents" aria-label="Date range">
        {RANGES.map((r) => (
          <Link key={r.key} href={`/admin/analytics?range=${r.key}`} aria-current={r.key === range.key ? "page" : undefined} className={pill(r.key === range.key)}>
            {r.label}
          </Link>
        ))}
      </nav>
      <details className="relative">
        <summary className={cn(pill(range.key === "custom"), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>Custom</summary>
        <form action="/admin/analytics" className="absolute left-0 z-20 mt-2 w-72 space-y-3 border border-line bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.1)]">
          <input type="hidden" name="range" value="custom" />
          <label className="block text-xs text-ink-muted">
            From
            <input type="date" name="from" required defaultValue={range.current.from} max={shopTodayIso()} className="input mt-1 w-full" />
          </label>
          <label className="block text-xs text-ink-muted">
            To
            <input type="date" name="to" required defaultValue={range.current.to} max={shopTodayIso()} className="input mt-1 w-full" />
          </label>
          <button type="submit" className="btn-primary w-full">
            Apply
          </button>
        </form>
      </details>
    </div>
  );
}
