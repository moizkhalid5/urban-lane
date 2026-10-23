import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ensureReviewTables } from "@/lib/reviews/db";
import { isValidReviewToken } from "@/lib/reviews/request";
import { OrderReviewForm } from "@/components/reviews/OrderReviewForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rate your order", robots: { index: false, follow: false } };

type PageProps = { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ t?: string }> };

/** "How was your order?": the private link from the delivery email / WhatsApp (lib/reviews/request). */
export default async function OrderReviewPage({ params, searchParams }: PageProps) {
  const { orderNumber } = await params;
  const { t } = await searchParams;
  const order = isValidReviewToken(orderNumber, t)
    ? await prisma.order.findUnique({
        where: { orderNumber },
        select: {
          orderNumber: true,
          email: true,
          firstName: true,
          lastName: true,
          shipCity: true,
          fulfillmentStatus: true,
          items: { select: { productId: true, productTitle: true, image: true, product: { select: { slug: true, status: true } } } },
        },
      })
    : null;

  if (!order) {
    return (
      <Message title="This link doesn't work">
        Please use the link from your email or WhatsApp message exactly as it was sent. If it still doesn&apos;t
        work, <Link href="/contact" className="underline">contact us</Link>.
      </Message>
    );
  }
  if (order.fulfillmentStatus !== "DELIVERED") {
    return <Message title="Not delivered yet">You can rate your order {order.orderNumber} once it has been delivered.</Message>;
  }

  await ensureReviewTables();
  // One entry per product (an order can have the same product in two sizes)
  const products = [
    ...new Map(
      order.items
        .filter((i) => i.productId && i.product?.status === "ACTIVE")
        .map((i) => [i.productId!, { productId: i.productId!, title: i.productTitle, image: i.image, slug: i.product!.slug }]),
    ).values(),
  ];
  const reviewed = new Set(
    (
      await prisma.review.findMany({
        where: { email: order.email.toLowerCase(), productId: { in: products.map((p) => p.productId) } },
        select: { productId: true },
      })
    ).map((r) => r.productId),
  );

  return (
    <div className="container-site max-w-2xl py-12">
      <h1 className="text-3xl font-medium">How was your order?</h1>
      <p className="mt-2 text-ink-muted">
        Hi {order.firstName}, thank you for shopping with Urban Lane. Rate the items from order {order.orderNumber}. Your
        review helps other shoppers choose.
      </p>
      <OrderReviewForm
        orderNumber={order.orderNumber}
        token={t!}
        defaultName={`${order.firstName} ${order.lastName.slice(0, 1)}${order.lastName ? "." : ""}`.trim()}
        defaultCity={order.shipCity}
        items={products.map((p) => ({ ...p, reviewed: reviewed.has(p.productId) }))}
      />
    </div>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="container-site max-w-xl py-24 text-center">
      <h1 className="text-2xl font-medium">{title}</h1>
      <p className="mt-3 text-ink-muted">{children}</p>
      <Link href="/" className="btn-secondary mt-8 inline-block">
        Continue shopping
      </Link>
    </div>
  );
}
