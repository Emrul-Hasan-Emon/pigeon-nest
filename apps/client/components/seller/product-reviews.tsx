'use client';

import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { ThumbsUp } from 'lucide-react';
import { Stars } from '@/components/reviews/stars';
import { ReplyThread, type ThreadApi } from '@/components/reviews/reply-thread';
import { ReportDialog } from '@/components/reviews/report-dialog';
import { useToast } from '@/components/ui/toast';
import {
  deleteReplyAsSeller,
  editReplyAsSeller,
  getRatingSummary,
  listProductReviews,
  listThread,
  replyAsSeller,
  reportReplyAsSeller,
  reportReviewAsSeller,
} from '@/lib/api/reviews';
import { formatDate } from '@/lib/datetime';
import { useCursorList } from '@/lib/hooks/use-cursor-list';
import type { PublicReview, RatingSummary } from '@/types/review';
import { DELETE_ENABLED } from '@/lib/features';

const chip = (on: boolean) =>
  `rounded-full border px-4 py-1.5 text-base font-medium transition-colors ${
    on ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:border-foreground'
  }`;

/** How many reviews gave each star rating. Tap a row to see only those reviews. */
function Breakdown({ summary, rating, onPick }: { summary: RatingSummary; rating: number | null; onPick: (r: number | null) => void }) {
  return (
    <ul className="w-full max-w-sm space-y-1.5" aria-label="Reviews by star rating">
      {([5, 4, 3, 2, 1] as const).map((star) => {
        const n = summary.breakdown[String(star) as '1'];
        const pct = summary.ratingCount ? Math.round((n / summary.ratingCount) * 100) : 0;
        return (
          <li key={star}>
            <button
              type="button"
              onClick={() => onPick(rating === star ? null : star)}
              aria-pressed={rating === star}
              aria-label={`${star} star reviews: ${n}. ${rating === star ? 'Show all' : 'Show only these'}`}
              disabled={n === 0}
              className="flex w-full items-center gap-3 rounded text-base enabled:hover:bg-muted disabled:opacity-50"
            >
              <span className="w-14 text-left text-muted-foreground">{star} star</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span className={`block h-full rounded-full ${rating === star ? 'bg-primary' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
              </span>
              <span className="w-8 text-right tabular-nums text-muted-foreground">{n}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ReviewItem({ review }: { review: PublicReview }) {
  const { showToast } = useToast();
  const [reporting, setReporting] = useState(false);
  // The shop reads the same public thread customers see, and can answer in it.
  const api = useMemo<ThreadApi>(
    () => ({
      load: (parentId, cursor) => listThread(review.id, { parentId: parentId ?? undefined, cursor, limit: 10 }),
      create: (body, parentId) => replyAsSeller(review.id, body, parentId),
      edit: (id, body) => editReplyAsSeller(id, body),
      remove: DELETE_ENABLED ? (id: number) => deleteReplyAsSeller(id) : undefined,
      report: (id, reason, note) => reportReplyAsSeller(id, reason, note),
    }),
    [review.id],
  );

  return (
    <li className="border-b border-border py-5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} size={18} />
        {review.title && <h3 className="text-lg font-semibold text-foreground">{review.title}</h3>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {review.reviewerName} · <span className="font-medium text-primary">Verified purchase</span> · <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
        {review.editedAt && ' · edited'}
      </p>
      {review.comment && <p className="mt-2 whitespace-pre-wrap text-base text-foreground">{review.comment}</p>}
      {review.images.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {review.images.map((img) => (
            <li key={img.id}>
              <a href={img.url} target="_blank" rel="noreferrer" aria-label="Open this photo in a new tab">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="Photo from the buyer" loading="lazy" className="h-24 w-24 rounded-lg border border-border object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
          {review.helpfulCount} {review.helpfulCount === 1 ? 'person found' : 'people found'} this helpful
        </span>
        <button type="button" onClick={() => setReporting(true)} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          Report this review
        </button>
      </div>
      <ReplyThread api={api} me="seller" canReply count={review.replyCount} defaultOpen />
      {reporting && (
        <ReportDialog
          what="review"
          send={(reason, note) => reportReviewAsSeller(review.id, reason, note)}
          onClose={() => setReporting(false)}
          onDone={() => {
            setReporting(false);
            showToast('Reported. A moderator will look at it.', 'success');
          }}
        />
      )}
    </li>
  );
}

/**
 * The reviews of one product, laid out as customers see them on the storefront: the average and a star breakdown,
 * filters for stars and photos, a sort, then every review with its photos and replies. The shop can answer in place.
 */
export function SellerProductReviews({ productId }: { productId: number }) {
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [withPhotos, setWithPhotos] = useState(false);
  const [sort, setSort] = useState<'newest' | 'helpful'>('newest');

  const fetcher = useMemo(() => (p: Record<string, string | number | boolean | undefined>) => listProductReviews(productId, p), [productId]);
  const filters = useMemo(() => ({ rating: rating ?? undefined, withPhotos: withPhotos || undefined, sort }), [rating, withPhotos, sort]);
  const list = useCursorList(fetcher, filters, 8);

  useEffect(() => {
    let live = true;
    getRatingSummary(productId)
      .then((s) => live && setSummary(s))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [productId]);

  const count = summary?.ratingCount ?? 0;
  const filtered = rating !== null || withPhotos;

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-20">
      <h2 id="reviews-title" className="mb-3 font-[family-name:var(--font-serif)] text-2xl font-medium tracking-tight text-foreground">
        Customer reviews
      </h2>
      <div className="rounded-xl border border-border bg-card p-6">
        {summary && count === 0 && !filtered ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-base text-muted-foreground">
            No reviews yet. Reviews come from people who bought this product.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="shrink-0">
                <p className="font-[family-name:var(--font-serif)] text-5xl font-semibold text-foreground">
                  {summary ? summary.ratingAverage.toFixed(1) : '–'}
                  <span className="text-xl text-muted-foreground"> / 5</span>
                </p>
                <Stars value={summary?.ratingAverage ?? 0} size={22} />
                <p className="mt-1 text-base text-muted-foreground">
                  {count} {count === 1 ? 'review' : 'reviews'}
                </p>
              </div>
              {summary && <Breakdown summary={summary} rating={rating} onPick={setRating} />}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter and sort reviews">
              <button type="button" className={chip(withPhotos)} aria-pressed={withPhotos} onClick={() => setWithPhotos((v) => !v)}>
                With photos
              </button>
              {rating !== null && (
                <button type="button" className={chip(true)} onClick={() => setRating(null)}>
                  {rating} star ✕
                </button>
              )}
              <label className="ml-auto flex items-center gap-2 text-base text-muted-foreground">
                Sort by
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as 'newest' | 'helpful')}
                  className="rounded-full border border-border bg-white px-4 text-base text-foreground focus:border-foreground focus:outline-none"
                >
                  <option value="newest">Newest</option>
                  <option value="helpful">Most helpful</option>
                </select>
              </label>
            </div>

            {list.error && (
              <p role="alert" className="mt-3 text-base text-destructive">
                {list.error}
              </p>
            )}
            {list.loading ? (
              <p className="py-8 text-center text-base text-muted-foreground">Loading reviews…</p>
            ) : list.rows.length === 0 ? (
              <p className="py-8 text-center text-base text-muted-foreground">No reviews match these filters.</p>
            ) : (
              <ul className="mt-2">
                {list.rows.map((r) => (
                  <ReviewItem key={r.id} review={r} />
                ))}
              </ul>
            )}
            {!list.loading && list.hasMore && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={list.more}
                  disabled={list.moreLoading}
                  className="rounded-full border border-border px-6 py-2 text-base font-medium text-foreground hover:bg-muted disabled:opacity-60"
                >
                  {list.moreLoading ? 'Loading…' : 'Show more reviews'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
