'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Stars } from '@/components/reviews/stars';
import { listPublicSellerReviews } from '@/lib/api/reviews';
import { productHref } from '@/lib/api/storefront';
import { formatDate } from '@/lib/datetime';
import { useCursorList } from '@/lib/hooks/use-cursor-list';
import type { SellerDetails, SellerPublicReview } from '@/types/storefront';

function ReviewRow({ review }: { review: SellerPublicReview }) {
  return (
    <li className="border-b border-st-line py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} size={16} />
        {review.title && <h3 className="font-semibold text-st-ink">{review.title}</h3>}
      </div>
      <p className="mt-1 text-sm text-st-slate">
        {review.reviewerName} · <span className="font-medium text-st-teal">Verified purchase</span> ·{' '}
        <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
      </p>
      {review.comment && <p className="mt-2 whitespace-pre-wrap text-st-ink">{review.comment}</p>}
      {review.images.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {review.images.map((img) => (
            <li key={img.id}>
              <a href={img.url} target="_blank" rel="noreferrer" aria-label="Open this photo in a new tab">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="Photo from the buyer" loading="lazy" className="h-20 w-20 rounded-lg border border-st-line object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-sm text-st-slate">
        About{' '}
        <Link href={productHref({ id: review.productId, slug: review.productSlug })} className="font-medium text-st-ink underline-offset-2 hover:underline">
          {review.productName}
        </Link>
      </p>
    </li>
  );
}

/** What buyers say about this shop: the average, a star breakdown, then reviews of any of its products. */
export function SellerReviewsBlock({ seller }: { seller: SellerDetails }) {
  const [rating, setRating] = useState<number | null>(null);
  const fetcher = useMemo(() => (p: Record<string, string | number | boolean | undefined>) => listPublicSellerReviews(seller.id, p), [seller.id]);
  const filters = useMemo(() => ({ rating: rating ?? undefined }), [rating]);
  const list = useCursorList(fetcher, filters, 8);
  const count = seller.ratingCount;

  return (
    <section aria-labelledby="seller-reviews-title" className="mb-8 rounded-xl border border-st-line bg-white p-4 sm:p-6">
      <h2 id="seller-reviews-title" className="font-display mb-4 text-xl font-semibold text-st-ink">
        What buyers say
      </h2>
      {count === 0 ? (
        <p className="rounded-xl border border-dashed border-st-line p-6 text-center text-st-slate">No reviews yet. Reviews come from people who bought from this seller.</p>
      ) : (
        <>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="shrink-0">
              <p className="font-display text-4xl font-semibold text-st-ink">
                {seller.ratingAverage.toFixed(1)}
                <span className="text-lg text-st-slate"> / 5</span>
              </p>
              <Stars value={seller.ratingAverage} size={20} />
              <p className="mt-1 text-sm text-st-slate">
                {count} {count === 1 ? 'review' : 'reviews'}
              </p>
            </div>
            <ul className="w-full max-w-xs space-y-1" aria-label="Reviews by star rating">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const n = seller.breakdown[String(star) as '1'];
                const pct = count ? Math.round((n / count) * 100) : 0;
                return (
                  <li key={star}>
                    <button
                      type="button"
                      onClick={() => setRating(rating === star ? null : star)}
                      aria-pressed={rating === star}
                      aria-label={`${star} star reviews: ${n}. ${rating === star ? 'Show all' : 'Show only these'}`}
                      disabled={n === 0}
                      className="flex w-full items-center gap-2 rounded text-sm enabled:hover:bg-st-dove disabled:opacity-50"
                    >
                      <span className="w-10 text-left text-st-slate">{star} star</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-st-dove">
                        <span className={`block h-full rounded-full ${rating === star ? 'bg-st-teal' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-8 text-right tabular-nums text-st-slate">{n}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {rating !== null && (
            <button type="button" onClick={() => setRating(null)} className="mt-4 rounded-full border border-st-ink bg-st-ink px-3 py-1 text-sm text-white">
              {rating} star ✕
            </button>
          )}
          {list.error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {list.error}
            </p>
          )}
          {list.loading ? (
            <p className="py-6 text-center text-st-slate">Loading reviews…</p>
          ) : (
            <ul className="mt-3">
              {list.rows.map((r) => (
                <ReviewRow key={r.id} review={r} />
              ))}
            </ul>
          )}
          {!list.loading && list.hasMore && (
            <div className="mt-3 flex justify-center">
              <button type="button" onClick={list.more} disabled={list.moreLoading} className="rounded-full border border-st-line px-5 py-2 text-sm font-medium text-st-ink hover:border-st-ink disabled:opacity-60">
                {list.moreLoading ? 'Loading…' : 'Show more reviews'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
