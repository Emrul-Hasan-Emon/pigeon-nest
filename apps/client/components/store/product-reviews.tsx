'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ThumbsUp } from 'lucide-react';
import { Stars } from '@/components/reviews/stars';
import { ReplyThread, type ThreadApi } from '@/components/reviews/reply-thread';
import { ReportDialog } from '@/components/reviews/report-dialog';
import { useToast } from '@/components/ui/toast';
import {
  getMyVotes,
  getRatingSummary,
  listPendingReviews,
  listProductReviews,
  listThread,
  reportReplyAsCustomer,
  reportReviewAsCustomer,
  unvoteHelpful,
  voteHelpful,
} from '@/lib/api/reviews';
import { ApiError } from '@/lib/api/http';
import { loginUrlFor } from '@/lib/auth/next-path';
import { getUserToken } from '@/lib/auth/user-token';
import { formatDate } from '@/lib/datetime';
import { useCursorList } from '@/lib/hooks/use-cursor-list';
import type { PublicReview, RatingSummary } from '@/types/review';

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal ${
    on ? 'border-st-ink bg-st-ink text-white' : 'border-st-line bg-white text-st-ink hover:border-st-ink'
  }`;

function Breakdown({ summary, rating, onPick }: { summary: RatingSummary; rating: number | null; onPick: (r: number | null) => void }) {
  return (
    <ul className="w-full max-w-xs space-y-1" aria-label="Reviews by star rating">
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
              className="flex w-full items-center gap-2 rounded text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal enabled:hover:bg-st-dove disabled:opacity-50"
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
  );
}

function ReviewItem({
  review,
  signedIn,
  voted,
  onVote,
}: {
  review: PublicReview;
  signedIn: boolean;
  voted: boolean;
  onVote: (review: PublicReview) => void;
}) {
  const { showToast } = useToast();
  const [reporting, setReporting] = useState(false);
  const api = useMemo<ThreadApi>(
    () => ({
      load: (parentId, cursor) => listThread(review.id, { parentId: parentId ?? undefined, cursor, limit: 10 }),
      report: signedIn ? (id, reason, note) => reportReplyAsCustomer(id, reason, note) : undefined,
    }),
    [review.id, signedIn],
  );

  return (
    <li className="border-b border-st-line py-5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} />
        {review.title && <h3 className="font-medium text-st-ink">{review.title}</h3>}
      </div>
      <p className="mt-1 text-xs text-st-slate">
        {review.reviewerName} · <span className="text-st-teal">Verified purchase</span> · <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
        {review.editedAt && ' · edited'}
      </p>
      {review.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-st-ink">{review.comment}</p>}
      {review.images.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
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
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onVote(review)}
          aria-pressed={voted}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal ${
            voted ? 'border-st-teal bg-st-teal/10 text-st-teal' : 'border-st-line text-st-slate hover:border-st-ink hover:text-st-ink'
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
          Helpful{review.helpfulCount > 0 && ` (${review.helpfulCount})`}
        </button>
        <button
          type="button"
          onClick={() => (signedIn ? setReporting(true) : (window.location.href = loginUrlFor(window.location.pathname + window.location.search)))}
          className="text-xs text-st-slate hover:text-st-ink hover:underline"
        >
          Report
        </button>
      </div>
      {review.replyCount > 0 && <ReplyThread api={api} me={null} canReply={false} count={review.replyCount} />}
      {reporting && (
        <ReportDialog
          what="review"
          send={(reason, note) => reportReviewAsCustomer(review.id, reason, note)}
          onClose={() => setReporting(false)}
          onDone={() => {
            setReporting(false);
            showToast('Thanks. A moderator will look at it.', 'success');
          }}
        />
      )}
    </li>
  );
}

/** Rating summary and every published review of one product. Open to everyone; voting and reporting need an account. */
export function ProductReviews({ productId }: { productId: number }) {
  const { showToast } = useToast();
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [withPhotos, setWithPhotos] = useState(false);
  const [sort, setSort] = useState<'newest' | 'helpful'>('newest');
  const [voted, setVoted] = useState<Set<number>>(new Set());
  const [signedIn, setSignedIn] = useState(false);
  const [canWrite, setCanWrite] = useState(false);

  const fetcher = useCallback((p: Record<string, string | number | boolean | undefined>) => listProductReviews(productId, p), [productId]);
  const filters = useMemo(() => ({ rating: rating ?? undefined, withPhotos: withPhotos || undefined, sort }), [rating, withPhotos, sort]);
  const list = useCursorList(fetcher, filters, 8);

  useEffect(() => {
    let live = true;
    getRatingSummary(productId)
      .then((s) => live && setSummary(s))
      .catch(() => undefined);
    if (getUserToken()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSignedIn(true);
      getMyVotes(productId)
        .then((v) => live && setVoted(new Set(v.reviewIds)))
        .catch(() => undefined);
      // a delivered, not yet reviewed order line for this product lets the customer write one
      listPendingReviews({ limit: 100 })
        .then((p) => live && setCanWrite(p.results.some((i) => i.productId === productId)))
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, [productId]);

  async function vote(review: PublicReview) {
    if (!getUserToken()) {
      window.location.href = loginUrlFor(window.location.pathname + window.location.search);
      return;
    }
    const was = voted.has(review.id);
    try {
      const r = was ? await unvoteHelpful(review.id) : await voteHelpful(review.id);
      setVoted((cur) => {
        const next = new Set(cur);
        if (was) next.delete(review.id);
        else next.add(review.id);
        return next;
      });
      list.setRows((rows) => rows.map((x) => (x.id === review.id ? { ...x, helpfulCount: r.helpfulCount } : x)));
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not save your vote.', 'error');
    }
  }

  const count = summary?.ratingCount ?? 0;
  const filtered = rating !== null || withPhotos;

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="mt-10 scroll-mt-20">
      <h2 id="reviews-title" className="font-display mb-3 text-lg font-semibold text-st-ink sm:text-2xl">Customer reviews</h2>

      {summary && count === 0 && !filtered ? (
        <p className="rounded-xl border border-dashed border-st-line p-6 text-center text-sm text-st-slate">
          No reviews yet. Reviews come from people who bought this product.
          {canWrite && <> <Link href="/reviews" className="font-medium text-st-teal underline">Write the first one</Link>.</>}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="shrink-0">
              <p className="font-display text-4xl font-semibold text-st-ink">{summary ? summary.ratingAverage.toFixed(1) : '–'}<span className="text-lg text-st-slate"> / 5</span></p>
              <Stars value={summary?.ratingAverage ?? 0} size={20} />
              <p className="mt-1 text-sm text-st-slate">{count} {count === 1 ? 'review' : 'reviews'}</p>
              {canWrite && <Link href="/reviews" className="mt-2 inline-block text-sm font-medium text-st-teal underline">Write a review</Link>}
            </div>
            {summary && <Breakdown summary={summary} rating={rating} onPick={setRating} />}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filter and sort reviews">
            <button type="button" className={chip(withPhotos)} aria-pressed={withPhotos} onClick={() => setWithPhotos((v) => !v)}>With photos</button>
            {rating !== null && (
              <button type="button" className={chip(true)} onClick={() => setRating(null)}>{rating} star ✕</button>
            )}
            <label className="ml-auto flex items-center gap-2 text-sm text-st-slate">
              Sort by
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as 'newest' | 'helpful')}
                className="h-9 rounded-full border border-st-line bg-white px-3 text-sm text-st-ink focus:border-st-ink focus:outline-none"
              >
                <option value="newest">Newest</option>
                <option value="helpful">Most helpful</option>
              </select>
            </label>
          </div>

          {list.error && <p role="alert" className="mt-3 text-sm text-red-700">{list.error}</p>}
          {list.loading ? (
            <p className="py-8 text-center text-sm text-st-slate">Loading reviews…</p>
          ) : list.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-st-slate">No reviews match these filters.</p>
          ) : (
            <ul className="mt-2">
              {list.rows.map((r) => (
                <ReviewItem key={r.id} review={r} signedIn={signedIn} voted={voted.has(r.id)} onVote={vote} />
              ))}
            </ul>
          )}
          {!list.loading && list.hasMore && (
            <div className="mt-3 flex justify-center">
              <button type="button" onClick={list.more} disabled={list.moreLoading} className="rounded-full border border-st-line px-5 py-2 text-sm font-medium text-st-ink hover:bg-st-dove disabled:opacity-60">
                {list.moreLoading ? 'Loading…' : 'Show more reviews'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
