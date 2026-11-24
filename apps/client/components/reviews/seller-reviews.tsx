'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Share2, ThumbsUp } from 'lucide-react';
import { field, outlineButton } from '@/components/orders/ui';
import { ReplyThread, type ThreadApi } from '@/components/reviews/reply-thread';
import { ReportDialog } from '@/components/reviews/report-dialog';
import { Stars } from '@/components/reviews/stars';
import { useToast } from '@/components/ui/toast';
import {
  deleteReplyAsSeller,
  editReplyAsSeller,
  getSellerReviewSummary,
  listSellerReviews,
  listThread,
  replyAsSeller,
  reportReplyAsSeller,
  reportReviewAsSeller,
} from '@/lib/api/reviews';
import { listMyProducts } from '@/lib/api/seller-products';
import { formatDate } from '@/lib/datetime';
import { useCursorList } from '@/lib/hooks/use-cursor-list';
import type { SellerReview, SellerReviewSummary } from '@/types/review';
import { LoadingBlock } from '@/components/ui/skeleton';
import { DELETE_ENABLED } from '@/lib/features';

function ReviewCard({ review, onChanged }: { review: SellerReview; onChanged: () => void }) {
  const { showToast } = useToast();
  const [reporting, setReporting] = useState(false);
  const api = useMemo<ThreadApi>(
    () => ({
      // the seller reads the same public thread the shoppers see
      load: (parentId, cursor) => listThread(review.id, { parentId: parentId ?? undefined, cursor, limit: 10 }),
      create: (body, parentId) => replyAsSeller(review.id, body, parentId),
      edit: (id, body) => editReplyAsSeller(id, body),
      remove: DELETE_ENABLED ? (id: number) => deleteReplyAsSeller(id) : undefined,
      report: (id, reason, note) => reportReplyAsSeller(id, reason, note),
    }),
    [review.id],
  );

  async function share() {
    const link = `${window.location.origin}/products/${review.productId}-${review.productSlug}`;
    const text = [
      `${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} ${review.rating} out of 5 for ${review.productName}`,
      review.title,
      review.comment ? `“${review.comment}”` : null,
      `— ${review.reviewerName}, ${formatDate(review.createdAt)}`,
      link,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: `Review of ${review.productName}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        showToast('Copied. Paste it in a message or post.', 'success');
      }
    } catch {
      // the share sheet was closed, nothing to do
    }
  }

  return (
    <li className={`rounded-xl border bg-card p-5 shadow-sm ${review.sellerReplied ? 'border-border' : 'border-amber-300'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/seller/products/${review.productId}`} className="text-lg font-semibold text-foreground no-underline hover:text-primary">
            {review.productName}
          </Link>
          <p className="text-sm text-muted-foreground">
            by <span className="font-medium text-foreground">{review.reviewerName}</span> · {formatDate(review.createdAt)}
            {review.editedAt && ' · edited'}
          </p>
        </div>
        <span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${review.sellerReplied ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
          {review.sellerReplied ? 'You replied' : 'Needs your reply'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} size={20} />
        <span className="text-base font-semibold text-foreground">{review.rating} out of 5</span>
        {review.title && <span className="text-base font-medium text-foreground">· {review.title}</span>}
      </div>
      {review.comment ? (
        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 px-4 py-3 text-base text-foreground">{review.comment}</p>
      ) : (
        <p className="mt-2 text-base text-muted-foreground">The customer gave stars only, with no written comment.</p>
      )}
      {review.images.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {review.images.map((i) => (
            <li key={i.id}>
              <a href={i.url} target="_blank" rel="noreferrer" aria-label="Open this photo in a new tab">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.url} alt="Photo from the buyer" loading="lazy" className="h-20 w-20 rounded-lg border border-border object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
          {review.helpfulCount} {review.helpfulCount === 1 ? 'person found' : 'people found'} this helpful
        </span>
        <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm font-medium text-foreground hover:bg-muted">
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share this review
        </button>
        <button type="button" onClick={() => setReporting(true)} className="text-sm text-muted-foreground hover:text-foreground hover:underline">Report this review</button>
      </div>
      <ReplyThread api={api} me="seller" canReply count={review.replyCount} onChanged={onChanged} defaultOpen />
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

/** What customers wrote about this shop's products, with the shop's replies. Customers show as a masked name. */
export function SellerReviews() {
  const [rating, setRating] = useState('');
  const [productId, setProductId] = useState('');
  const [unreplied, setUnreplied] = useState(false);
  const [summary, setSummary] = useState<SellerReviewSummary | null>(null);
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);

  const filters = useMemo(
    () => ({ rating: rating || undefined, productId: productId || undefined, unreplied: unreplied || undefined }),
    [rating, productId, unreplied],
  );
  const list = useCursorList<SellerReview>(listSellerReviews, filters, 10);

  useEffect(() => {
    getSellerReviewSummary(productId ? Number(productId) : undefined).then(setSummary).catch(() => undefined);
  }, [productId, list.rows.length]);
  useEffect(() => {
    listMyProducts({ limit: 100 })
      .then((r) => setProducts(r.results.map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => undefined);
  }, []);

  const dirty = Boolean(rating || productId || unreplied);
  return (
    <div>
      <section className="mb-6 grid gap-4 md:grid-cols-3" aria-label="Summary">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-muted-foreground">Average rating</p>
          <p className="mt-1 font-[family-name:var(--font-serif)] text-4xl font-semibold text-foreground">
            {summary && summary.ratingCount ? summary.ratingAverage.toFixed(1) : '—'}
            <span className="text-lg text-muted-foreground"> / 5</span>
          </p>
          <Stars value={summary?.ratingAverage ?? 0} size={20} />
          <p className="mt-1 text-sm text-muted-foreground">
            from {summary?.ratingCount ?? 0} {summary?.ratingCount === 1 ? 'review' : 'reviews'}
          </p>
        </div>
        <div className={`rounded-xl border p-5 ${summary && summary.unreplied > 0 ? 'border-amber-300 bg-amber-50' : 'border-border bg-card'}`}>
          <p className="text-sm font-semibold text-muted-foreground">Waiting for your reply</p>
          <p className={`mt-1 font-[family-name:var(--font-serif)] text-4xl font-semibold ${summary && summary.unreplied > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{summary?.unreplied ?? 0}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary && summary.unreplied > 0 ? 'A quick reply shows buyers you care.' : 'You have answered every review.'}
          </p>
          {summary && summary.unreplied > 0 && !unreplied && (
            <button type="button" onClick={() => setUnreplied(true)} className="mt-2 text-base font-semibold text-primary hover:underline">Show only these</button>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-2 text-sm text-muted-foreground">Reviews by stars (tap one to filter)</p>
          <ul className="space-y-1">
            {([5, 4, 3, 2, 1] as const).map((st) => {
              const n = summary ? summary.breakdown[String(st) as '1'] : 0;
              const pct = summary && summary.ratingCount ? Math.round((n / summary.ratingCount) * 100) : 0;
              return (
                <li key={st}>
                  <button
                    type="button"
                    disabled={n === 0}
                    aria-pressed={rating === String(st)}
                    onClick={() => setRating(rating === String(st) ? '' : String(st))}
                    className="flex w-full items-center gap-2 rounded text-base enabled:hover:bg-muted disabled:opacity-50"
                  >
                    <span className="w-14 text-left text-muted-foreground">{st} star</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className={`block h-full rounded-full ${rating === String(st) ? 'bg-primary' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-6 text-right tabular-nums text-muted-foreground">{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="block text-base text-foreground">
          Product
          <select className={`${field} mt-1 block w-64`} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">All my products</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block text-base text-foreground">
          Stars given
          <select className={`${field} mt-1 block w-60`} value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="">Any number of stars</option>
            {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s} {s === 1 ? 'star' : 'stars'}</option>)}
          </select>
        </label>
        <label className="block text-base text-foreground">
          Reply status
          <select className={`${field} mt-1 block w-52`} value={unreplied ? 'no' : ''} onChange={(e) => setUnreplied(e.target.value === 'no')}>
            <option value="">All reviews</option>
            <option value="no">Needs my reply</option>
          </select>
        </label>
        {dirty && <button type="button" className={outlineButton} onClick={() => { setRating(''); setProductId(''); setUnreplied(false); }}>Clear all filters</button>}
      </div>

      {list.error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{list.error}</p>}
      {list.loading ? (
        <LoadingBlock />
      ) : list.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {dirty ? 'No reviews match these filters.' : 'No reviews yet. They appear here after customers review delivered orders.'}
        </p>
      ) : (
        <ul className="space-y-4">{list.rows.map((r) => <ReviewCard key={r.id} review={r} onChanged={list.reload} />)}</ul>
      )}
      {!list.loading && list.hasMore && (
        <div className="mt-4 flex justify-center"><button type="button" onClick={list.more} disabled={list.moreLoading} className={outlineButton}>{list.moreLoading ? 'Loading…' : 'Show more reviews'}</button></div>
      )}
    </div>
  );
}
