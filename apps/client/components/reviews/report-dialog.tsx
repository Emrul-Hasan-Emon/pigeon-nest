'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { ApiError } from '@/lib/api/http';
import type { ReviewReportReason } from '@/types/review';

const REASONS: { value: ReviewReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'abusive', label: 'Abusive or offensive' },
  { value: 'fake', label: 'Fake or not a real purchase' },
  { value: 'irrelevant', label: 'Not about this product' },
  { value: 'other', label: 'Something else' },
];

const input = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none';

/** Asks why, then sends the report. The caller gives the send function for its role. */
export function ReportDialog({
  what,
  send,
  onClose,
  onDone,
}: {
  what: string;
  send: (reason: ReviewReportReason, note?: string) => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState<ReviewReportReason>('spam');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send(reason, note.trim() || undefined);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the report. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Report this ${what}`} onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">A moderator reads every report. The author is not told who reported.</p>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-foreground">What is wrong with it?</legend>
          <div className="space-y-1.5">
            {REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm">
                <input type="radio" name="reason" checked={reason === r.value} onChange={() => setReason(r.value)} />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium text-foreground">
          Details <span className="font-normal text-muted-foreground">(optional)</span>
          <textarea className={`${input} mt-1`} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {busy ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
