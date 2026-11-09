import type { Metadata } from "next";
import { UnsubscribeButton } from "@/components/marketing/UnsubscribeButton";
import { validUnsubscribe } from "@/lib/mail/marketing";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

/** The link at the bottom of every marketing email. Asks first, so a link checker can't unsubscribe anyone. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ e?: string; t?: string }> }) {
  const { e = "", t = "" } = await searchParams;
  const valid = !!e && !!t && validUnsubscribe(e, t);
  return (
    <div className="container-site flex flex-col items-center py-24 text-center">
      <h1 className="text-2xl font-medium">Unsubscribe</h1>
      {valid ? (
        <>
          <p className="mt-3 max-w-md text-ink-soft">
            Stop marketing emails to <span className="font-medium text-ink">{e}</span>? You&apos;ll still get emails
            about your orders.
          </p>
          <UnsubscribeButton email={e} token={t} />
        </>
      ) : (
        <p className="mt-3 max-w-md text-ink-soft">
          This link isn&apos;t valid. Please use the Unsubscribe link at the bottom of one of our emails, or contact us.
        </p>
      )}
    </div>
  );
}
