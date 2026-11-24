'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ReplyThread, type ThreadApi } from '@/components/reviews/reply-thread';
import { Stars } from '@/components/reviews/stars';
import { editReplyAsAdmin, deleteReplyAsAdmin, hideReply, listAdminReviews, listAdminThread, replyAsAdmin, restoreReply } from '@/lib/api/reviews';
import { formatDateTime } from '@/lib/datetime';
import { useCursorList } from '@/lib/hooks/use-cursor-list';
import { reviewStatusBadge } from './review-list';
import type { AdminReview } from '@/types/review';
import { DELETE_ENABLED } from '@/lib/features';

function Item({ review, onChanged }: { review: AdminReview; onChanged: () => void }) {
  const api = useMemo<ThreadApi>(
    () => ({
      load: (parentId, cursor) => listAdminThread(review.id, { parentId: parentId ?? undefined, cursor, limit: 20 }),
      create: (body, parentId) => replyAsAdmin(review.id, body, parentId),
      edit: (rid, body) => editReplyAsAdmin(rid, body),
      remove: DELETE_ENABLED ? (rid: number) => deleteReplyAsAdmin(rid) : undefined,
      hide: (rid, reason) => hideReply(rid, reason),
      restore: (rid) => restoreReply(rid),
    }),
    [review.id],
  );
  return (
    <li className="border-b border-border py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} size={16} />
        {review.title && <span className="font-semibold text-foreground">{review.title}</span>}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${reviewStatusBadge(review.status)}`}>{review.status === 'published' ? 'Published' : 'Hidden'}</span>
        {review.reportCount > 0 && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">{review.reportCount} {review.reportCount === 1 ? 'report' : 'reports'}</span>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <Link href={`/admin/users/${review.user.id}`} className="text-primary hover:underline">{review.user.name}</Link> · order {review.orderNumber} · {formatDateTime(review.createdAt)}
        {review.editedAt && ' · edited'} · {review.helpfulCount} helpful{review.imageCount > 0 && ` · ${review.imageCount} photo${review.imageCount === 1 ? '' : 's'}`}
      </p>
      {review.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{review.comment}</p>}
      <p className="mt-1 text-xs"><Link href={`/admin/reviews/${review.id}`} className="text-primary hover:underline">Open full review (hide, reports, history)</Link></p>
      <ReplyThread api={api} me="admin" canReply={review.status !== 'hidden'} count={review.replyCount} onChanged={onChanged} defaultOpen />
    </li>
  );
}

/** Every review of one product, hidden ones too, each with its full comment and reply thread. */
export function ProductReviewsPanel({ productId }: { productId: number }) {
  const [rating, setRating] = useState('');
  const [status, setStatus] = useState('');
  const filters = useMemo(() => ({ productId, rating: rating || undefined, status: status || undefined }), [productId, rating, status]);
  const list = useCursorList<AdminReview>(listAdminReviews, filters, 10);
  const sel = 'rounded-md border border-border bg-background px-2 py-1 text-sm';

  return (
    <section className="mt-5 rounded-xl border border-border bg-card p-5" aria-label="Reviews">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-foreground">Reviews and comments</h2>
        <div className="flex gap-2">
          <select className={sel} aria-label="Stars" value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="">Any stars</option>
            {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s} {s === 1 ? 'star' : 'stars'}</option>)}
          </select>
          <select className={sel} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="published">Published</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
      </div>
      {list.error && <p role="alert" className="text-sm text-destructive">{list.error}</p>}
      {list.loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading reviews…</p>
      ) : list.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No reviews found.</p>
      ) : (
        <ul>{list.rows.map((r) => <Item key={r.id} review={r} onChanged={list.reload} />)}</ul>
      )}
      {!list.loading && list.hasMore && (
        <div className="mt-3 flex justify-center">
          <button type="button" onClick={list.more} disabled={list.moreLoading} className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-muted disabled:opacity-60">
            {list.moreLoading ? 'Loading…' : 'Show more reviews'}
          </button>
        </div>
      )}
    </section>
  );
}
