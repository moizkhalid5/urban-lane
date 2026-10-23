import Link from "next/link";
import { ScrollRail } from "@/components/ui/ScrollRail";
import type { PublicReview } from "@/lib/reviews/queries";
import { Stars } from "./Stars";
import { SampleBadge } from "./ReviewBits";

/**
 * Homepage "Customer Reviews": the reviews ticked "Show on homepage" in Admin → Reviews (in the admin's
 * order), three across on desktop, two on tablets, one on phones. Hidden when there are none.
 */
export function CustomerReviewsCarousel({ reviews }: { reviews: PublicReview[] }) {
  if (reviews.length === 0) return null;
  return (
    <section className="container-site py-14" aria-labelledby="customer-reviews-heading">
      <div className="mb-10 flex items-center justify-center gap-5">
        <span className="h-px w-8 bg-ink/40 sm:w-28" aria-hidden />
        <h2
          id="customer-reviews-heading"
          className="whitespace-nowrap text-center text-base font-semibold uppercase tracking-[0.18em] sm:text-lg sm:tracking-[0.25em] md:text-xl"
        >
          Customer reviews
        </h2>
        <span className="h-px w-8 bg-ink/40 sm:w-28" aria-hidden />
      </div>

      <ScrollRail
        label="reviews"
        itemClassName="basis-full md:basis-[calc((100%-1rem)/2)] lg:basis-[calc((100%-2rem)/3)]"
      >
        {reviews.map((r) => (
          <figure key={r.id} className="flex h-full flex-col items-center px-14 text-center lg:px-10">
            {r.product ? (
              <Link href={`/products/${r.product.slug}`} className="line-clamp-2 text-base font-semibold hover:underline">
                {r.product.title}
              </Link>
            ) : (
              r.title && <p className="text-base font-semibold">{r.title}</p>
            )}
            <blockquote className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              {r.body && <p className="line-clamp-6">&ldquo;{r.body}&rdquo;</p>}
            </blockquote>
            <figcaption className="mt-3 text-sm font-medium">
              – {r.authorName}
              {r.authorCity && <span className="font-normal text-ink-muted">, {r.authorCity}</span>}
            </figcaption>
            <Stars value={r.rating} size={18} className="mt-3" />
            {r.isSample && (
              <span className="mt-2">
                <SampleBadge />
              </span>
            )}
          </figure>
        ))}
      </ScrollRail>
    </section>
  );
}
