'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReplyThread, type ThreadApi } from '@/components/reviews/reply-thread';
import { ReviewForm, type ReviewTarget } from '@/components/reviews/review-form';
import { Stars } from '@/components/reviews/stars';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import {
  deleteReplyAsCustomer,
  deleteReview,
  editReplyAsCustomer,
  listMyReviews,
  listPendingReviews,
  listThread,
  replyAsCustomer,
  reportReplyAsCustomer,
} from '@/lib/api/reviews';
import { productHref } from '@/lib/api/storefront';
import { ApiError } from '@/lib/api/http';
import { loginUrlFor } from '@/lib/auth/next-path';
import { getUserToken } from '@/lib/auth/user-token';
import { formatDate } from '@/lib/datetime';
import { useCursorList } from '@/lib/hooks/use-cursor-list';
import type { MyReview, PendingReviewItem } from '@/types/review';

const tab = (on: boolean) =>
  `-mb-px border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal ${
    on ? 'border-st-ink text-st-ink' : 'border-transparent text-st-slate hover:text-st-ink'
  }`;
const solid = 'rounded-full bg-st-ink px-4 py-1.5 text-sm font-semibold text-white hover:bg-st-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal';
const outline = 'rounded-full border border-st-line px-4 py-1.5 text-sm font-medium text-st-ink hover:bg-st-dove focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal';

function variant(skuData: Record<string, unknown> | null) {
  if (!skuData) return null;
  const label = typeof skuData.label === 'string' ? skuData.label : null;
  return label;
}

function Thumb({ url }: { url: string | null }) {
  return (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-st-dove">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />}
    </div>
  );
}

function MyReviewCard({ review, onEdit, onDelete, onChanged }: { review: MyReview; onEdit: () => void; onDelete: () => void; onChanged: () => void }) {
  const api = useMemo<ThreadApi>(
    () => ({
      load: (parentId, cursor) => listThread(review.id, { parentId: parentId ?? undefined, cursor, limit: 10 }),
      create: (body, parentId) => replyAsCustomer(review.id, body, parentId),
      edit: (id, body) => editReplyAsCustomer(id, body),
      remove: (id) => deleteReplyAsCustomer(id),
      report: (id, reason, note) => reportReplyAsCustomer(id, reason, note),
    }),
    [review.id],
  );
  const hidden = review.status === 'hidden';

  return (
    <li className="rounded-xl border border-st-line bg-white p-4">
      <div className="flex gap-3">
        <Thumb url={review.product.thumbnailUrl} />
        <div className="min-w-0 flex-1">
          {review.product.slug ? (
            <Link href={productHref({ id: review.productId, slug: review.product.slug })} className="line-clamp-1 font-medium text-st-ink hover:underline">{review.product.name}</Link>
          ) : (
            <p className="font-medium text-st-ink">{review.product.name ?? 'Removed product'}</p>
          )}
          <p className="text-xs text-st-slate">Order {review.orderNumber}{variant(review.skuData) ? ` · ${variant(review.skuData)}` : ''}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Stars value={review.rating} />
            <span className="text-xs text-st-slate">{formatDate(review.createdAt)}{review.editedAt ? ' · edited' : ''}</span>
            {hidden && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Hidden by a moderator</span>}
          </div>
        </div>
      </div>

      {hidden && (
        <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Nobody else can see this review right now. {review.hiddenReason ? <>Reason: {review.hiddenReason}</> : null}
        </p>
      )}
      {review.title && <p className="mt-3 font-medium text-st-ink">{review.title}</p>}
      {review.comment && <p className="mt-1 whitespace-pre-wrap text-sm text-st-ink">{review.comment}</p>}
      {review.images.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {review.images.map((img) => (
            <li key={img.id}>
              <a href={img.url} target="_blank" rel="noreferrer" aria-label="Open this photo in a new tab">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="Your photo" loading="lazy" className="h-16 w-16 rounded-lg border border-st-line object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onEdit} disabled={!review.canEdit} className={`${outline} disabled:opacity-50`} title={review.canEdit ? '' : hidden ? 'A hidden review cannot be edited' : 'You could edit for 30 days after posting'}>
          Edit
        </button>
        <button type="button" onClick={onDelete} className={outline}>Delete</button>
        <span className="ml-auto text-xs text-st-slate">{review.helpfulCount} found this helpful</span>
      </div>
      {review.canEdit && <p className="mt-1 text-xs text-st-slate">You can edit until {formatDate(review.editableUntil)}.</p>}

      {!hidden && <ReplyThread api={api} me="user" canReply count={review.replyCount} onChanged={onChanged} />}
    </li>
  );
}

/** "To review" (delivered items without a review) and "My reviews". `?item=` opens the form for that order line. */
export function MyReviews() {
  const router = useRouter();
  const params = useSearchParams();
  const { showToast } = useToast();
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<'pending' | 'mine'>(params.get('tab') === 'mine' ? 'mine' : 'pending');
  const [writing, setWriting] = useState<ReviewTarget | null>(null);
  const [editing, setEditing] = useState<MyReview | null>(null);
  const [deleting, setDeleting] = useState<MyReview | null>(null);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!getUserToken()) router.replace(loginUrlFor('/reviews'));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setReady(true);
  }, [router]);

  const pending = useCursorList<PendingReviewItem>(listPendingReviews, {}, 20);
  const mine = useCursorList<MyReview>(listMyReviews, {}, 10);
  const reloadAll = useCallback(() => {
    pending.reload();
    mine.reload();
  }, [pending, mine]);

  // arriving from an order page: open the form for that line once the list is in
  const wanted = Number(params.get('item'));
  useEffect(() => {
    if (opened || pending.loading || !wanted) return;
    const row = pending.rows.find((r) => r.id === wanted);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpened(true);
    if (row) setWriting({ orderItemId: row.id, productName: row.productName });
  }, [opened, pending.loading, pending.rows, wanted]);

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      await deleteReview(target.id);
      showToast('Review deleted. You can write a new one for this item.', 'success');
      reloadAll();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not delete the review.', 'error');
    }
  }

  if (!ready) return null;

  return (
    <div>
      <div role="tablist" className="mb-4 flex gap-1 border-b border-st-line">
        <button role="tab" aria-selected={view === 'pending'} className={tab(view === 'pending')} onClick={() => setView('pending')}>
          To review{!pending.loading && pending.rows.length > 0 ? ` (${pending.rows.length}${pending.hasMore ? '+' : ''})` : ''}
        </button>
        <button role="tab" aria-selected={view === 'mine'} className={tab(view === 'mine')} onClick={() => setView('mine')}>
          My reviews
        </button>
      </div>

      {view === 'pending' ? (
        <>
          {pending.error && <p role="alert" className="mb-3 text-sm text-red-700">{pending.error}</p>}
          {pending.loading ? (
            <p className="py-10 text-center text-st-slate">Loading…</p>
          ) : pending.rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-st-line p-8 text-center text-sm text-st-slate">
              Nothing waiting. Once an order is delivered, the items show up here so you can review them.
            </p>
          ) : (
            <ul className="space-y-3">
              {pending.rows.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-xl border border-st-line bg-white p-3">
                  <Thumb url={i.thumbnailUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-medium text-st-ink">{i.productName}</p>
                    <p className="text-xs text-st-slate">Order {i.orderNumber}{variant(i.skuData) ? ` · ${variant(i.skuData)}` : ''} · {formatDate(i.orderedAt)}</p>
                  </div>
                  <button type="button" className={solid} onClick={() => setWriting({ orderItemId: i.id, productName: i.productName })}>Write a review</button>
                </li>
              ))}
            </ul>
          )}
          {!pending.loading && pending.hasMore && (
            <div className="mt-3 flex justify-center"><button type="button" onClick={pending.more} disabled={pending.moreLoading} className={outline}>{pending.moreLoading ? 'Loading…' : 'Show more'}</button></div>
          )}
        </>
      ) : (
        <>
          {mine.error && <p role="alert" className="mb-3 text-sm text-red-700">{mine.error}</p>}
          {mine.loading ? (
            <p className="py-10 text-center text-st-slate">Loading…</p>
          ) : mine.rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-st-line p-8 text-center text-sm text-st-slate">You have not reviewed anything yet.</p>
          ) : (
            <ul className="space-y-3">
              {mine.rows.map((r) => (
                <MyReviewCard key={r.id} review={r} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} onChanged={() => mine.reload()} />
              ))}
            </ul>
          )}
          {!mine.loading && mine.hasMore && (
            <div className="mt-3 flex justify-center"><button type="button" onClick={mine.more} disabled={mine.moreLoading} className={outline}>{mine.moreLoading ? 'Loading…' : 'Show more'}</button></div>
          )}
        </>
      )}

      {writing && (
        <ReviewForm
          target={writing}
          onClose={() => setWriting(null)}
          onSaved={() => {
            setWriting(null);
            showToast('Thanks, your review is live.', 'success');
            setView('mine');
            reloadAll();
          }}
        />
      )}
      {editing && (
        <ReviewForm
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            showToast('Review updated.', 'success');
            mine.reload();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this review?"
          description="It disappears for everyone and the rating is updated. You can write a new review for the same item afterwards."
          confirmLabel="Delete review"
          onClose={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
