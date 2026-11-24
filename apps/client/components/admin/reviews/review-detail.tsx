'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Cards } from '@/components/commission/parts';
import { outlineButton } from '@/components/orders/ui';
import { ReplyThread, type ThreadApi } from '@/components/reviews/reply-thread';
import { Stars } from '@/components/reviews/stars';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import {
  deleteReplyAsAdmin,
  editReplyAsAdmin,
  getAdminReview,
  hideReply,
  hideReview,
  listAdminThread,
  replyAsAdmin,
  restoreReply,
  restoreReview,
} from '@/lib/api/reviews';
import { formatDateTime } from '@/lib/datetime';
import { reviewStatusBadge } from './review-list';
import type { AdminReviewDetails } from '@/types/review';
import { LoadingBlock } from '@/components/ui/skeleton';
import { useBreadcrumbTitle } from '@/components/ui/breadcrumbs';

const textarea = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none';
const section = 'rounded-xl border border-border bg-card p-4 shadow-sm';
const REASON: Record<string, string> = { spam: 'Spam', abusive: 'Abusive', fake: 'Fake', irrelevant: 'Not relevant', other: 'Other' };

function ReasonDialog({
  title,
  help,
  required,
  confirm,
  tone,
  onSubmit,
  onClose,
}: {
  title: string;
  help: string;
  required: boolean;
  confirm: string;
  tone: 'danger' | 'primary';
  onSubmit: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work. Try again.');
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted-foreground">{help}</p>
        <label className="block text-sm font-medium">
          Reason {!required && <span className="font-normal text-muted-foreground">(optional)</span>}
          <textarea className={`${textarea} mt-1`} rows={3} maxLength={1000} required={required} minLength={required ? 3 : undefined} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <button type="submit" disabled={busy || (required && reason.trim().length < 3)} className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${tone === 'danger' ? 'bg-destructive' : 'bg-primary'}`}>{confirm}</button>
        </div>
      </form>
    </Modal>
  );
}

/** One review for a moderator: the text, the thread, the reports and every change made to it. */
export function AdminReviewDetail({ id }: { id: number }) {
  const { showToast } = useToast();
  const [review, setReview] = useState<AdminReviewDetails | null>(null);
  useBreadcrumbTitle(review ? `Review #${review.id}` : null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'hide' | 'restore' | null>(null);

  const load = useCallback(() => {
    getAdminReview(id)
      .then(setReview)
      .catch((e) => (e instanceof NotFoundApiError ? setMissing(true) : setError(e instanceof ApiError ? e.message : 'Could not load this review.')));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const api = useMemo<ThreadApi>(
    () => ({
      load: (parentId, cursor) => listAdminThread(id, { parentId: parentId ?? undefined, cursor, limit: 20 }),
      create: (body, parentId) => replyAsAdmin(id, body, parentId),
      edit: (rid, body) => editReplyAsAdmin(rid, body),
      remove: (rid) => deleteReplyAsAdmin(rid),
      hide: (rid, reason) => hideReply(rid, reason),
      restore: (rid) => restoreReply(rid),
    }),
    [id],
  );

  if (missing) return <p className="py-10 text-center text-muted-foreground">This review no longer exists. <Link href="/admin/reviews" className="text-primary underline">Back to reviews</Link></p>;
  if (error) return <p role="alert" className="py-10 text-center text-destructive">{error}</p>;
  if (!review) return <LoadingBlock />;

  const hidden = review.status === 'hidden';
  const openReports = review.reports.filter((r) => r.status === 'open').length;

  return (
    <div className="space-y-5">
      <Link href="/admin/reviews" className="text-sm text-primary hover:underline">← All reviews</Link>

      <div className={section}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Stars value={review.rating} size={20} />
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${reviewStatusBadge(review.status)}`}>{hidden ? 'Hidden' : 'Published'}</span>
            </div>
            {review.title && <h1 className="mt-2 text-xl font-semibold text-foreground">{review.title}</h1>}
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href={`/admin/users/${review.user.id}`} className="font-medium text-primary hover:underline">{review.user.name}</Link>
              {' '}({review.user.phone ?? review.user.email ?? 'no contact'}) on{' '}
              <Link href={`/admin/catalog/products/${review.product.id}`} className="font-medium text-foreground hover:underline">{review.product.name}</Link>
              {' '}from <Link href={`/admin/sellers/${review.seller.id}`} className="text-primary hover:underline">{review.seller.name}</Link>
            </p>
            <p className="text-xs text-muted-foreground">
              Posted {formatDateTime(review.createdAt)}{review.editedAt && `, edited ${formatDateTime(review.editedAt)}`} · order{' '}
              <Link href={`/admin/orders/${review.orderId}`} className="text-primary hover:underline">{review.orderNumber}</Link>
            </p>
          </div>
          <div className="flex gap-2">
            {hidden ? (
              <button type="button" className={outlineButton} onClick={() => setDialog('restore')}>Restore review</button>
            ) : (
              <button type="button" className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:opacity-90" onClick={() => setDialog('hide')}>Hide review</button>
            )}
          </div>
        </div>

        {hidden && (
          <p role="status" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Hidden {review.hiddenAt && formatDateTime(review.hiddenAt)}. Reason: {review.hiddenReason}. It does not count in the product rating.
          </p>
        )}
        {review.comment && <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{review.comment}</p>}
        {review.images.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {review.images.map((i) => (
              <li key={i.id}>
                <a href={i.url} target="_blank" rel="noreferrer" aria-label="Open this photo in a new tab">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.url} alt="Photo on the review" className="h-24 w-24 rounded-md border border-border object-cover" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Cards
        items={[
          { label: 'Found helpful', value: String(review.helpfulCount) },
          { label: 'Replies in the thread', value: String(review.replyCount) },
          { label: 'Open reports', value: String(openReports), tone: openReports > 0 ? 'warn' : 'good', hint: `${review.reports.length} in total` },
        ]}
      />

      <section className={section} aria-label="Replies">
        <h2 className="text-base font-semibold text-foreground">Replies</h2>
        <p className="text-sm text-muted-foreground">Only the reviewer, the seller and Support write here. Hide a reply to remove it from public view; its text stays visible to you. You can answer as Support.</p>
        <ReplyThread api={api} me="admin" canReply={!hidden} count={review.replyCount} onChanged={load} />
      </section>

      <section className={section} aria-label="Reports">
        <h2 className="mb-2 text-base font-semibold text-foreground">Reports</h2>
        {review.reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody reported this review or its replies.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {review.reports.map((r) => (
              <li key={r.id} className="py-2">
                <span className="font-medium capitalize">{r.targetType}</span> reported as <strong>{REASON[r.reason]}</strong> by {r.reporterName}{' '}
                <span className="text-muted-foreground">({r.reporterType === 'user' ? 'customer' : r.reporterType}) · {formatDateTime(r.createdAt)}</span>
                {r.note && <p className="text-muted-foreground">“{r.note}”</p>}
                <p className="text-xs text-muted-foreground">
                  {r.status === 'open' ? 'Waiting for a decision.' : `${r.status === 'dismissed' ? 'Dismissed' : 'Hidden'} by ${r.resolvedByName ?? 'an admin'}${r.resolutionNote ? `: ${r.resolutionNote}` : ''}`}
                </p>
              </li>
            ))}
          </ul>
        )}
        {openReports > 0 && <Link href="/admin/reviews/reports" className="mt-2 inline-block text-sm text-primary hover:underline">Settle them in the report queue</Link>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={section} aria-label="Status history">
          <h2 className="mb-2 text-base font-semibold text-foreground">Hide and restore history</h2>
          {review.statusHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Never hidden.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {review.statusHistory.map((h) => (
                <li key={h.id} className="py-2">
                  <span className="font-medium capitalize">{h.targetType}</span> {h.fromStatus} → <strong>{h.toStatus}</strong> by {h.creatorName ?? 'unknown'}{' '}
                  <span className="text-muted-foreground">· {formatDateTime(h.createdAt)}</span>
                  {h.reason && <p className="text-muted-foreground">{h.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={section} aria-label="Edit history">
          <h2 className="mb-2 text-base font-semibold text-foreground">Edits by the customer</h2>
          {review.editHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Never edited.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {review.editHistory.map((e) => (
                <li key={e.id} className="py-2">
                  <span className="text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                  {e.fromRating !== e.toRating && <p>Rating {e.fromRating} → {e.toRating}</p>}
                  {e.fromTitle !== e.toTitle && <p>Title: “{e.fromTitle ?? ''}” → “{e.toTitle ?? ''}”</p>}
                  {e.fromComment !== e.toComment && <p className="whitespace-pre-wrap">Text: “{e.fromComment ?? ''}” → “{e.toComment ?? ''}”</p>}
                  {(e.imagesAdded > 0 || e.imagesRemoved > 0) && <p>Photos: +{e.imagesAdded} / −{e.imagesRemoved}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {dialog === 'hide' && (
        <ReasonDialog
          title="Hide this review"
          help="It disappears for the public, its votes and replies close, and the product rating is recalculated without it. The customer sees the reason."
          required
          confirm="Hide review"
          tone="danger"
          onClose={() => setDialog(null)}
          onSubmit={async (reason) => {
            setReview(await hideReview(id, reason));
            setDialog(null);
            showToast('Review hidden.', 'success');
          }}
        />
      )}
      {dialog === 'restore' && (
        <ReasonDialog
          title="Restore this review"
          help="It goes back on the product page and counts in the rating again."
          required={false}
          confirm="Restore review"
          tone="primary"
          onClose={() => setDialog(null)}
          onSubmit={async (reason) => {
            setReview(await restoreReview(id, reason || undefined));
            setDialog(null);
            showToast('Review restored.', 'success');
          }}
        />
      )}
    </div>
  );
}
