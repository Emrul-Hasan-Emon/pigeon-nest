'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { createReview, updateReview } from '@/lib/api/reviews';
import { ApiError } from '@/lib/api/http';
import { StarInput } from './stars';
import type { MyReview, ReviewImage } from '@/types/review';

const MAX_PHOTOS = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const input = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none';

export interface ReviewTarget {
  orderItemId: number;
  productName: string;
}

/**
 * Write a review (`target`) or change one (`existing`). Photos: up to 5, images only, 5 MB each.
 * When editing, current photos can be dropped and new ones added.
 */
export function ReviewForm({
  target,
  existing,
  onClose,
  onSaved,
}: {
  target?: ReviewTarget;
  existing?: MyReview;
  onClose: () => void;
  onSaved: (review: MyReview) => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [keep, setKeep] = useState<ReviewImage[]>(existing?.images ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const name = existing?.product.name ?? target?.productName ?? 'this product';
  const room = MAX_PHOTOS - keep.length - files.length;

  function pick(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    const tooBig = picked.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" is larger than 5 MB.`);
      return;
    }
    const notImage = picked.find((f) => !f.type.startsWith('image/'));
    if (notImage) {
      setError(`"${notImage.name}" is not an image.`);
      return;
    }
    setError(null);
    setFiles((cur) => [...cur, ...picked].slice(0, MAX_PHOTOS - keep.length));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError('Choose a star rating first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let saved: MyReview;
      if (existing) {
        const removed = existing.images.filter((i) => !keep.some((k) => k.id === i.id)).map((i) => i.id);
        saved = await updateReview(
          existing.id,
          {
            rating: rating !== existing.rating ? rating : undefined,
            // a blank value clears the field on the server
            title: title.trim() !== (existing.title ?? '') ? title.trim() : undefined,
            comment: comment.trim() !== (existing.comment ?? '') ? comment.trim() : undefined,
            removeImageIds: removed.length ? removed : undefined,
          },
          files,
        );
      } else {
        saved = await createReview({ orderItemId: target!.orderItemId, rating, title: title.trim() || undefined, comment: comment.trim() || undefined }, files);
      }
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your review. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={existing ? 'Edit your review' : 'Write a review'} onClose={onClose} widthClassName="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {existing ? 'You can edit for 30 days after posting.' : 'Your review is public. Only your first name and last initial show.'} Product: <strong className="text-foreground">{name}</strong>
        </p>
        <StarInput value={rating} onChange={setRating} />
        <label className="block text-sm font-medium text-foreground">
          Title <span className="font-normal text-muted-foreground">(optional)</span>
          <input className={`${input} mt-1`} maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sum it up in a few words" />
        </label>
        <label className="block text-sm font-medium text-foreground">
          Your review <span className="font-normal text-muted-foreground">(optional)</span>
          <textarea className={`${input} mt-1`} rows={5} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How were the birds, the packing and the delivery?" />
          <span className="mt-0.5 block text-right text-xs text-muted-foreground">{comment.length}/2000</span>
        </label>

        <div>
          <p className="mb-1 text-sm font-medium text-foreground">Photos <span className="font-normal text-muted-foreground">(up to 5)</span></p>
          {(keep.length > 0 || files.length > 0) && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {keep.map((i) => (
                <li key={i.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.url} alt="" className="h-16 w-16 rounded-md border border-border object-cover" />
                  <button type="button" aria-label="Remove this photo" onClick={() => setKeep((c) => c.filter((k) => k.id !== i.id))} className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-foreground text-xs text-background">×</button>
                </li>
              ))}
              {previews.map((u, idx) => (
                <li key={u} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-16 w-16 rounded-md border border-border object-cover" />
                  <button type="button" aria-label="Remove this photo" onClick={() => setFiles((c) => c.filter((_, j) => j !== idx))} className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-foreground text-xs text-background">×</button>
                </li>
              ))}
            </ul>
          )}
          {room > 0 && (
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                pick(e.target.files);
                e.target.value = '';
              }}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-muted"
            />
          )}
          <p className="mt-1 text-xs text-muted-foreground">{room > 0 ? `${room} more allowed. ` : 'The limit of 5 is reached. '}Images only, 5 MB each.</p>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {busy ? 'Saving…' : existing ? 'Save changes' : 'Post review'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
