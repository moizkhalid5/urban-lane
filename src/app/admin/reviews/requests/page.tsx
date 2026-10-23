import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/guards";
import { ensureReviewTables } from "@/lib/reviews/db";
import { whatsappReviewLink } from "@/lib/reviews/request";
import { EmailAllButton, ReviewRequestButtons } from "@/components/admin/ReviewRequestButtons";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/** Admin → Reviews → Ask customers: ask delivered orders to rate what they bought (email or WhatsApp). */
export default async function ReviewRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireStaff();
  await ensureReviewTables();
  const page = Math.max(1, Number((await searchParams).page) || 1);

  const [total, notAsked, orders] = await Promise.all([
    prisma.order.count({ where: { fulfillmentStatus: "DELIVERED" } }),
    prisma.order.count({ where: { fulfillmentStatus: "DELIVERED", reviewRequest: { is: null } } }),
    prisma.order.findMany({
      where: { fulfillmentStatus: "DELIVERED" },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        orderNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        shipCity: true,
        updatedAt: true,
        items: { select: { productId: true } },
        reviewRequest: { select: { emailedAt: true, whatsappAt: true } },
      },
    }),
  ]);
  // Reviews already received for each order (same email, a product from the order)
  const emails = [...new Set(orders.map((o) => o.email.toLowerCase()))];
  const reviews = emails.length
    ? await prisma.review.findMany({ where: { email: { in: emails }, verifiedPurchase: true }, select: { email: true, productId: true } })
    : [];
  const reviewedCount = (o: (typeof orders)[number]) => {
    const products = new Set(o.items.map((i) => i.productId).filter(Boolean));
    return reviews.filter((r) => r.email === o.email.toLowerCase() && r.productId && products.has(r.productId)).length;
  };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/reviews" className="text-sm text-ink-muted hover:text-ink">
          ← Reviews
        </Link>
        <h1 className="mt-1 text-2xl font-medium">Ask customers for reviews</h1>
      </div>
      <p className="max-w-3xl text-sm text-ink-muted">
        When you mark an order <strong>Delivered</strong>, the customer is emailed automatically: &ldquo;How was your
        order?&rdquo; with a private link to rate what they bought (no login needed). Their reviews are marked{" "}
        <strong>Verified buyer</strong> and wait in <Link href="/admin/reviews?tab=pending" className="underline">Waiting for approval</Link>{" "}
        unless auto-approve is on. Use this page to ask customers whose orders were delivered before, or to send the
        link on WhatsApp: the button opens WhatsApp with the message typed in; press send.
      </p>

      <section className="card space-y-3 p-5">
        <h2 className="font-medium">Delivered orders not asked yet: {notAsked}</h2>
        <EmailAllButton count={notAsked} />
      </section>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Delivered</th>
              <th className="p-3">Reviews</th>
              <th className="p-3">Ask</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-ink-muted">
                  No delivered orders yet.
                </td>
              </tr>
            )}
            {orders.map((o) => {
              const items = new Set(o.items.map((i) => i.productId).filter(Boolean)).size;
              const got = reviewedCount(o);
              return (
                <tr key={o.orderNumber} className="border-b border-line-soft last:border-0">
                  <td className="p-3">
                    <Link href={`/admin/orders/${o.orderNumber}`} className="underline">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="p-3">
                    {o.firstName} {o.lastName}
                    <span className="block text-xs text-ink-muted">
                      {o.shipCity}
                      {o.phone ? ` · ${o.phone}` : ""}
                    </span>
                  </td>
                  <td className="p-3 text-ink-muted">{o.updatedAt.toLocaleDateString("en-GB")}</td>
                  <td className="p-3">
                    <span className={got > 0 ? "text-success" : "text-ink-muted"}>
                      {got} of {items}
                    </span>
                  </td>
                  <td className="p-3">
                    <ReviewRequestButtons
                      orderNumber={o.orderNumber}
                      emailedAt={o.reviewRequest?.emailedAt?.toISOString() ?? null}
                      whatsappAt={o.reviewRequest?.whatsappAt?.toISOString() ?? null}
                      whatsappHref={whatsappReviewLink(o)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/admin/reviews/requests?page=${page - 1}`} className="underline">
              ← Newer
            </Link>
          )}
          <span className="text-ink-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/admin/reviews/requests?page=${page + 1}`} className="underline">
              Older →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
