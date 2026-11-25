import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { getBaseCurrency } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { madeUpCandidates, madeUpSummary } from "@/lib/orders/admin-orders";
import { MadeUpSalesForm } from "@/components/admin/orders/MadeUpSalesForm";

export const dynamic = "force-dynamic";

/** Admin → Orders → Made-up sales (lib/orders/admin-orders.ts). */
export default async function MadeUpSalesPage() {
  await requireAdmin();
  const [summary, candidates, currency] = await Promise.all([madeUpSummary(), madeUpCandidates({ beauty: true, soldOut: true }), getBaseCurrency()]);
  const d = (x: Date) => x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-ink-muted hover:text-ink">← Orders</Link>
        <h1 className="mt-1 text-2xl font-medium">Made-up sales</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-soft">
          Pretend sales for the Dashboard and Analytics only. They don&apos;t change stock, the &ldquo;sold&rdquo; numbers or best sellers
          shoppers see, nobody is emailed or asked for a review, and they are marked &ldquo;Made-up&rdquo; in Orders. Remove them here
          whenever you like.
        </p>
      </div>

      <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-ink-muted">Made-up orders</p><p className="mt-1 text-2xl font-medium">{summary.orders}</p></div>
        <div className="card p-5"><p className="text-sm text-ink-muted">Pieces</p><p className="mt-1 text-2xl font-medium">{summary.pieces}</p></div>
        <div className="card p-5"><p className="text-sm text-ink-muted">Sales</p><p className="mt-1 text-2xl font-medium">{formatMoney(summary.totalCents, currency)}</p></div>
      </div>
      {summary.from && summary.to && (
        <p className="text-sm text-ink-muted">Dated {d(summary.from)} to {d(summary.to)}.</p>
      )}

      <MadeUpSalesForm counts={{ beauty: candidates.beauty.length, soldOut: candidates.soldOut.length }} existing={summary.orders} />
    </div>
  );
}
