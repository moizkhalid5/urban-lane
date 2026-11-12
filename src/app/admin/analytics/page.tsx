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
import { recentActivity, recentOrders } from "@/lib/analytics/activity";
import { ChartCard } from "@/components/admin/analytics/ChartCard";
import { HeatmapViewer } from "@/components/admin/analytics/HeatmapViewer";
import { ConnectCard, NeedsGa, Panel, SourceError, StatTile } from "@/components/admin/analytics/ReportParts";
import { Columns, Donut, FunnelChart, Gauge, HourHeatmap, Treemap, Waterfall } from "@/components/admin/analytics/Charts";
import { ActivityTimeline, GradientKpi, MiniStat, RankedBars, RecentOrdersTable, SignalBars, StatusBar, TagCloud } from "@/components/admin/analytics/Dashboard";
import { DEPARTMENT_COLORS, DEVICE_COLORS, PALETTE, PAYMENT_COLORS, VISITOR_COLORS } from "@/components/admin/analytics/palette";

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
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const seconds = (s: number | null) => (s === null ? "—" : s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`);

const PAYMENT_LABELS: Record<string, string> = {
  COD: "Cash on delivery",
  EASYPAISA: "Easypaisa",
  JAZZCASH: "JazzCash",
  BANK_TRANSFER: "Bank transfer",
};

const settle = <T,>(p: Promise<T> | null) =>
  p ? p.then((value) => ({ value, error: null as string | null })).catch((e: unknown) => ({ value: null, error: e instanceof Error ? e.message : "Unknown error" })) : null;

type Search = { range?: string; from?: string; to?: string };

/**
 * Admin → Analytics dashboard: the shop's own sales (always exact), Google Analytics (visits, funnel, traffic)
 * and Microsoft Clarity (behaviour) once connected in Admin → Settings, and the shop's own click and scroll
 * heatmaps. Each kind of figure gets the chart that suits it: trend lines for change over time, donuts for a
 * whole split into a few parts, a waterfall for how sales add up, a weekday × hour heatmap, a treemap of
 * categories, a funnel, gauges for rates, and ranked bars for top lists.
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaff();
  const sp = await searchParams;
  const range = reportRange(sp.range, new Date(), { from: sp.from, to: sp.to });
  const [currency, access, store, pages, activity, latest] = await Promise.all([
    getBaseCurrency(),
    getReportAccess(),
    storeReport(range),
    heatmapPages(range.current.from, range.current.to).catch(() => []),
    recentActivity(7),
    recentOrders(6),
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
  const otherPay = store.byPayment.filter((p) => !PAYMENT_COLORS[p.method]).reduce((s, p) => s + p.cents, 0);
  const deptOf = (name: string) => {
    const top = name.split(" · ")[0];
    return DEPARTMENT_COLORS.find((d) => d.name.toLowerCase() === top.toLowerCase())?.name ?? top;
  };
  const named = (rows: { name: string; value: number }[], colors: Record<string, string>) => {
    const known = rows.filter((r) => colors[r.name.toLowerCase()]).map((r) => ({ ...r, name: cap(r.name), color: colors[r.name.toLowerCase()] }));
    const rest = rows.filter((r) => !colors[r.name.toLowerCase()]).reduce((s, r) => s + r.value, 0);
    return rest ? [...known, { name: "Other", value: rest, color: PALETTE.other }] : known;
  };
  const engaged = g?.engagementRate ?? null;

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
          <p className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <span className="font-semibold">{count.format(liveNow)}</span>
            <span className="text-ink-muted">{liveNow === 1 ? "visitor" : "visitors"} right now</span>
          </p>
        )}
      </div>

      <RangePicker range={range} />

      {/* Headline figures */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1760px]:grid-cols-6">
        <GradientKpi
          tone="sales"
          icon="sales"
          label="Total sales"
          value={money(store.current.salesCents)}
          now={store.current.salesCents}
          before={store.previous.salesCents}
          mini={{ kind: "bars", values: days.map((d) => d.cents) }}
        />
        <GradientKpi
          tone="orders"
          icon="orders"
          label="Orders"
          value={count.format(store.current.orders)}
          now={store.current.orders}
          before={store.previous.orders}
          mini={{ kind: "area", values: days.map((d) => d.orders) }}
        />
        <GradientKpi
          tone="aov"
          icon="aov"
          label="Average order value"
          value={money(store.current.aovCents)}
          now={store.current.aovCents}
          before={store.previous.aovCents}
          mini={{ kind: "line", values: days.map((d) => (d.orders ? d.cents / d.orders : 0)) }}
        />
        <GradientKpi
          tone="sessions"
          icon="sessions"
          label="Sessions"
          value={g ? count.format(g.sessions) : "—"}
          now={g?.sessions ?? null}
          before={g?.previousSessions ?? null}
          hint={g ? undefined : "Connect Google Analytics"}
          mini={g ? { kind: "bars", values: g.sessionsByDay.map((d) => d.sessions) } : undefined}
        />
        <GradientKpi
          tone="conversion"
          icon="conversion"
          label="Conversion rate"
          value={g ? pct(rate(store.current.orders, g.sessions)) : "—"}
          now={g ? rate(store.current.orders, g.sessions) : null}
          before={g ? rate(store.previous.orders, g.previousSessions) : null}
          points
          hint={g ? "orders ÷ sessions" : "needs sessions"}
          mini={g ? { kind: "line", values: g.sessionsByDay.map((d, i) => (d.sessions ? (days[i]?.orders ?? 0) / d.sessions : 0)) } : undefined}
        />
        <GradientKpi
          tone="returning"
          icon="returning"
          label="Returning customers"
          value={pct(store.current.returningRate)}
          now={store.current.returningRate}
          before={store.previous.returningRate}
          points
          hint={`of ${count.format(store.current.customers)} ${store.current.customers === 1 ? "customer" : "customers"}`}
          mini={{ kind: "ring", value: store.current.returningRate }}
        />
      </div>

      {/* Trend + payment split */}
      <div className="grid gap-5 xl:grid-cols-12">
        <ChartCard
          className="xl:col-span-8"
          currentLabel={span(range.current)}
          previousLabel={span(range.previous)}
          title={
            <div className="mb-3">
              <h2 className="text-[15px] font-semibold">Overview</h2>
              <p className="text-xs text-ink-muted">Day by day, against the period before</p>
            </div>
          }
          series={[
            {
              key: "sales",
              tab: "Total sales",
              unit: currency.symbol,
              points: days.map((d) => ({ date: d.date, previousDate: d.previousDate, current: d.cents / 100, previous: d.previousCents / 100 })),
            },
            {
              key: "orders",
              tab: "Orders",
              points: days.map((d) => ({ date: d.date, previousDate: d.previousDate, current: d.orders, previous: d.previousOrders })),
            },
            {
              key: "sessions",
              tab: "Sessions",
              unavailable: g ? undefined : "Connect Google Analytics in Settings to see sessions",
              points: g
                ? g.sessionsByDay.map((d, i) => ({ date: d.date, previousDate: range.previous.days[i] ?? null, current: d.sessions, previous: d.previousSessions }))
                : [],
            },
          ]}
          footer={
            <div className="mt-5 grid gap-4 border-t border-line-soft pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat icon="gross" color={PALETTE.violet} label="Gross sales" value={money(b.grossCents)} now={b.grossCents} before={pb.grossCents} />
              <MiniStat icon="discount" color={PALETTE.red} label="Discounts given" value={money(b.discountCents)} now={b.discountCents} before={pb.discountCents} lowerIsBetter />
              <MiniStat icon="shipping" color={PALETTE.aqua} label="Shipping charged" value={money(b.shippingCents)} now={b.shippingCents} before={pb.shippingCents} />
              <MiniStat icon="items" color={PALETTE.orange} label="Items sold" value={count.format(b.items)} />
            </div>
          }
        />

        <Panel title="Sales by payment method" className="xl:col-span-4">
          <Donut
            label="Sales by payment method"
            rows={[
              ...store.byPayment
                .filter((p) => PAYMENT_COLORS[p.method])
                .map((p) => ({ name: PAYMENT_LABELS[p.method] ?? p.method, value: p.cents, color: PAYMENT_COLORS[p.method] })),
              ...(otherPay ? [{ name: "Other", value: otherPay, color: PALETTE.other }] : []),
            ]}
            currency={currency}
            centerLabel="total sales"
          />
          <ul className="mt-5 grid grid-cols-2 gap-3 border-t border-line-soft pt-4 text-sm">
            {store.byPayment.slice(0, 4).map((p) => (
              <li key={p.method}>
                <p className="text-xs text-ink-muted">{PAYMENT_LABELS[p.method] ?? p.method}</p>
                <p className="font-semibold">
                  {count.format(p.orders)} {p.orders === 1 ? "order" : "orders"}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {ga?.value?.stale && <SourceError source="Google Analytics" message="Google didn't answer just now." saved />}
      {ga?.error && <SourceError source="Google Analytics" message={ga.error} />}

      {/* How sales add up + when they come in */}
      <div className="grid gap-5 xl:grid-cols-12">
        <Panel title="How the sales add up" note="this period" className="xl:col-span-5">
          <Waterfall
            currency={currency}
            steps={[
              { label: "Gross", value: b.grossCents, kind: "add" },
              { label: "Discounts", value: b.discountCents, kind: "subtract" },
              { label: "Shipping", value: b.shippingCents, kind: "add" },
              ...(b.taxCents ? [{ label: "Taxes", value: b.taxCents, kind: "add" as const }] : []),
              { label: "Total", value: b.totalCents, kind: "total" },
            ]}
          />
          <p className="mt-3 text-xs text-ink-muted">Cancelled, returned, refunded and failed orders aren&apos;t counted.</p>
        </Panel>
        <Panel title="When orders come in" note="by weekday and hour, Pakistan time" className="xl:col-span-7">
          <HourHeatmap grid={store.byHour} />
        </Panel>
      </div>

      {/* What sells */}
      <div className="grid gap-5 xl:grid-cols-12">
        <Panel title="Top products" note="by sales, before discounts" className="xl:col-span-5">
          <RankedBars
            rows={store.topProducts.slice(0, 6).map((p) => ({
              name: p.title,
              value: p.cents,
              extra: `${count.format(p.units)} sold`,
              image: p.image,
              href: p.productId ? `/admin/products/${p.productId}` : null,
            }))}
            format={money}
            color={PALETTE.violet}
            empty="No orders in this period."
          />
        </Panel>
        <Panel title="Sales by category" note="area = sales" className="xl:col-span-7">
          <Treemap
            items={store.byCategory.map((c) => ({ name: c.name, value: c.cents, group: deptOf(c.name), extra: `${count.format(c.units)} sold` }))}
            groups={DEPARTMENT_COLORS}
            currency={currency}
          />
        </Panel>
      </div>

      {/* Orders right now */}
      <div className="grid gap-5 xl:grid-cols-12">
        <Panel
          title="Order status"
          note={
            <Link href="/admin/orders" className="underline underline-offset-2">
              All orders
            </Link>
          }
          className="xl:col-span-8"
        >
          <p className="mb-2 text-xs text-ink-muted">Orders placed in this period, by where they are now</p>
          <StatusBar rows={store.fulfilment} />
          <h3 className="mb-3 mt-6 text-sm font-semibold">Latest orders</h3>
          <RecentOrdersTable orders={latest} money={money} />
        </Panel>
        <Panel title="Recent activity" className="xl:col-span-4">
          <ActivityTimeline items={activity} />
        </Panel>
      </div>

      {/* Where and how */}
      <div className="grid gap-5 xl:grid-cols-12">
        <Panel title="Sales by city" note="from the delivery address" className="xl:col-span-7">
          <Columns
            label="Sales by city"
            rows={store.byCity.slice(0, 8).map((c) => ({ name: c.name, value: c.cents, extra: `${count.format(c.orders)} ${c.orders === 1 ? "order" : "orders"}` }))}
            currency={currency}
            color={PALETTE.blue}
          />
        </Panel>
        <Panel title="From visit to order" note={g ? "visitors who did each step" : undefined} className="xl:col-span-5">
          {g ? (
            <FunnelChart
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
      </div>

      {/* Visitors (Google Analytics) */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Sessions by device">
          {g ? <Donut label="Sessions by device" rows={named(g.devices, DEVICE_COLORS)} centerLabel="sessions" /> : <NeedsGa />}
        </Panel>
        <Panel title="New and returning visitors">
          {g ? <Donut label="New and returning visitors" rows={named(g.visitorTypes ?? [], VISITOR_COLORS)} centerLabel="visitors" /> : <NeedsGa />}
        </Panel>
        <Panel title="Engaged sessions" note={g ? "stayed 10s+, saw 2+ pages or bought" : undefined}>
          {g ? (
            <div className="pt-2">
              <Gauge value={engaged} label="of sessions were engaged" color={PALETTE.aqua} note="The rest left quickly without doing anything." />
            </div>
          ) : (
            <NeedsGa />
          )}
        </Panel>
        <Panel title="Sessions by traffic source">{g ? <RankedBars rows={g.channels.slice(0, 6)} color={PALETTE.orange} /> : <NeedsGa />}</Panel>
        <Panel title="Sessions by country">{g ? <RankedBars rows={g.countries.slice(0, 6)} color={PALETTE.aqua} /> : <NeedsGa />}</Panel>
        <Panel title="Top referrers" note={g ? "sites that sent visitors" : undefined}>
          {g ? <RankedBars rows={g.sources.slice(0, 6)} color={PALETTE.berry} /> : <NeedsGa />}
        </Panel>
        <Panel title="Top searches" note={g ? "what shoppers typed in search" : undefined}>
          {g ? <TagCloud rows={g.searches.slice(0, 18)} /> : <NeedsGa what="searches" />}
        </Panel>
        <Panel title="Top landing pages" note={g ? "first page of a visit" : undefined} className="xl:col-span-2">
          {g ? (
            <RankedBars rows={g.landingPages.slice(0, 6).map((p) => ({ ...p, href: p.name.startsWith("/") ? p.name : null }))} color={PALETTE.blue} />
          ) : (
            <NeedsGa />
          )}
        </Panel>
      </div>

      <Panel title="Most viewed products" note={g ? "views → added to bag → ordered" : undefined}>
        {!g ? (
          <NeedsGa what="product views" />
        ) : g.products.length ? (
          <ProductViews rows={g.products} />
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">No product views recorded for this period yet.</p>
        )}
      </Panel>

      {/* Heatmaps: the shop's own click and scroll maps. */}
      <section className="space-y-4 rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(17,17,17,0.04)]" id="heatmaps">
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
              <StatTile label="Average scroll depth" value={c.scrollDepth === null ? "—" : `${Math.round(c.scrollDepth)}%`} hint="of each page" />
              <StatTile label="Active time" value={seconds(c.activeSeconds)} hint={c.totalSeconds !== null ? `of ${seconds(c.totalSeconds)} on the page` : undefined} />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Frustration signals" note="share of sessions">
                <SignalBars rows={c.signals} />
                <p className="mt-4 text-xs text-ink-muted">
                  Green under 3% of sessions, orange 3–10%, red over 10%. Watch these sessions in Clarity&apos;s Recordings, filtered by the
                  signal, to see what went wrong.
                </p>
              </Panel>
              <div className="space-y-5">
                <Panel title="How far down shoppers scroll">
                  <Gauge value={c.scrollDepth === null ? null : c.scrollDepth / 100} label="of a page, on average" color={PALETTE.violet} />
                </Panel>
                <Panel title="Most visited pages" note="last 3 days">
                  <RankedBars rows={c.pages.map((p) => ({ name: p.name.replace(/^https?:\/\/[^/]+/, "") || "/", value: p.value }))} color={PALETTE.violet} />
                </Panel>
              </div>
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

/** Most viewed products: views, then how many of those viewers added to bag and ordered, as bars on one scale. */
function ProductViews({ rows }: { rows: { name: string; views: number; addedToBag: number; purchased: number }[] }) {
  const max = Math.max(...rows.map((r) => r.views), 1);
  const keys = [
    { key: "views", label: "Views", color: PALETTE.blue },
    { key: "addedToBag", label: "Added to bag", color: PALETTE.orange },
    { key: "purchased", label: "Ordered", color: PALETTE.aqua },
  ] as const;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-muted">
        {keys.map((k) => (
          <span key={k.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: k.color }} />
            {k.label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-ink-muted">
            <tr>
              <th className="pb-2 font-normal">Product</th>
              <th className="w-[38%] pb-2 font-normal">
                <span className="sr-only">Bars</span>
              </th>
              <th className="w-16 pb-2 text-right font-normal">Views</th>
              <th className="w-16 pb-2 text-right font-normal">To bag</th>
              <th className="w-16 pb-2 text-right font-normal">Ordered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((p) => (
              <tr key={p.name}>
                <td className="max-w-0 truncate py-2.5 pr-4">{p.name}</td>
                <td className="py-2.5 pr-4" aria-hidden>
                  <div className="space-y-[2px]">
                    {keys.map((k) => (
                      <div key={k.key} className="h-[5px] rounded-full" style={{ width: `${Math.max(p[k.key] ? 1.5 : 0, (p[k.key] / max) * 100)}%`, background: k.color }} />
                    ))}
                  </div>
                </td>
                <td className="py-2.5 text-right tabular-nums">{count.format(p.views)}</td>
                <td className="py-2.5 text-right tabular-nums">{count.format(p.addedToBag)}</td>
                <td className="py-2.5 text-right tabular-nums">{count.format(p.purchased)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
