'use client';

import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { Cards } from '@/components/commission/parts';
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
import { formatDateTime } from '@/lib/datetime';
import { useCursorList } from '@/lib/hooks/use-cursor-list';
import type { SellerReview, SellerReviewSummary } from '@/types/review';
import { LoadingBlock } from '@/components/ui/skeleton';

function ReviewCard({ review, onChanged }: { review: SellerReview; onChanged: () => void }) {
  const { showToast } = useToast();
  const [reporting, setReporting] = useState(false);
  const api = useMemo<ThreadApi>(
    () => ({
      // the seller reads the same public thread the shoppers see
      load: (parentId, cursor) => listThread(review.id, { parentId: parentId ?? undefined, cursor, limit: 10 }),
      create: (body, parentId) => replyAsSeller(review.id, body, parentId),
      edit: (id, body) => editReplyAsSeller(id, body),
      remove: (id) => deleteReplyAsSeller(id),
      report: (id, reason, note) => reportReplyAsSeller(id, reason, note),
    }),
    [review.id],
  );

  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} />
        {review.title && <h3 className="font-medium text-foreground">{review.title}</h3>}
        {!review.sellerReplied && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Not answered</span>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {review.reviewerName} on <strong className="font-medium text-foreground">{review.productName}</strong> · {formatDateTime(review.createdAt)}
        {review.editedAt && ' · edited'} · {review.helpfulCount} found it helpful
      </p>
      {review.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{review.comment}</p>}
      {review.images.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {review.images.map((i) => (
            <li key={i.id}>
              <a href={i.url} target="_blank" rel="noreferrer" aria-label="Open this photo in a new tab">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.url} alt="Photo from the buyer" loading="lazy" className="h-16 w-16 rounded-md border border-border object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={() => setReporting(true)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">Report this review</button>
      </div>
      <ReplyThread api={api} me="seller" canReply count={review.replyCount} onChanged={onChanged} />
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
      <Cards
        items={[
          { label: 'Average rating', value: summary && summary.ratingCount ? `${summary.ratingAverage.toFixed(2)} / 5` : '—', hint: summary ? `${summary.ratingCount} ${summary.ratingCount === 1 ? 'review' : 'reviews'}` : undefined },
          { label: 'Waiting for your reply', value: String(summary?.unreplied ?? 0), tone: summary && summary.unreplied > 0 ? 'warn' : 'good' },
          {
            label: 'Rated 1 or 2 stars',
            value: String(summary ? summary.breakdown['1'] + summary.breakdown['2'] : 0),
            tone: summary && summary.breakdown['1'] + summary.breakdown['2'] > 0 ? 'warn' : 'good',
            hint: summary ? ([5, 4, 3, 2, 1] as const).map((st) => `${st}★ ${summary.breakdown[String(st) as '1']}`).join(' · ') : undefined,
          },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className={`${field} w-56`} aria-label="Product" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">All products</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className={`${field} w-36`} aria-label="Stars" value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="">Any rating</option>
          {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s} {s === 1 ? 'star' : 'stars'}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={unreplied} onChange={(e) => setUnreplied(e.target.checked)} />
          Not answered yet
        </label>
        {dirty && <button type="button" className={outlineButton} onClick={() => { setRating(''); setProductId(''); setUnreplied(false); }}>Clear filters</button>}
      </div>

      {list.error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{list.error}</p>}
      {list.loading ? (
        <LoadingBlock />
      ) : list.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {dirty ? 'No reviews match these filters.' : 'No reviews yet. They appear here after customers review delivered orders.'}
        </p>
      ) : (
        <ul className="space-y-3">{list.rows.map((r) => <ReviewCard key={r.id} review={r} onChanged={list.reload} />)}</ul>
      )}
      {!list.loading && list.hasMore && (
        <div className="mt-4 flex justify-center"><button type="button" onClick={list.more} disabled={list.moreLoading} className={outlineButton}>{list.moreLoading ? 'Loading…' : 'Load more'}</button></div>
      )}
    </div>
  );
}
