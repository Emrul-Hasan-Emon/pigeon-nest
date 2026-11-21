'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ListFrame, td, th, usePagedList } from '@/components/commission/parts';
import { field } from '@/components/orders/ui';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/http';
import { listReports, resolveReport } from '@/lib/api/reviews';
import { formatDateTime } from '@/lib/datetime';
import type { ReviewReport } from '@/types/review';

const REASON: Record<string, string> = { spam: 'Spam', abusive: 'Abusive', fake: 'Fake', irrelevant: 'Not relevant', other: 'Other' };
const STATE: Record<string, { label: string; tone: string }> = {
  open: { label: 'Open', tone: 'bg-amber-100 text-amber-800' },
  resolved_hidden: { label: 'Hidden', tone: 'bg-destructive/10 text-destructive' },
  dismissed: { label: 'Dismissed', tone: 'bg-muted text-muted-foreground' },
};

function ResolveDialog({ report, action, onClose, onDone }: { report: ReviewReport; action: 'hide' | 'dismiss'; onClose: () => void; onDone: () => void }) {
  const { showToast } = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await resolveReport(report.id, action, note.trim() || undefined);
      showToast(action === 'hide' ? `The ${report.targetType} is hidden.` : 'Report dismissed.', 'success');
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not settle this report.');
      setBusy(false);
    }
  }
  return (
    <Modal title={action === 'hide' ? `Hide the ${report.targetType}` : 'Dismiss this report'} onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {action === 'hide'
            ? `The ${report.targetType} disappears for the public and every open report on it closes.`
            : 'Only this report closes. The text stays up.'}
        </p>
        <label className="block text-sm font-medium">
          Note <span className="font-normal text-muted-foreground">(optional, kept in the history)</span>
          <textarea className={`${field} mt-1 h-auto`} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <button type="submit" disabled={busy} className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${action === 'hide' ? 'bg-destructive' : 'bg-primary'}`}>
            {action === 'hide' ? 'Hide it' : 'Dismiss'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type Pick = { report: ReviewReport; action: 'hide' | 'dismiss' };

/** The table itself. The parent remounts it (by key) to refetch after a report is settled. */
function ReportTable({ status, targetType, onPick }: { status: string; targetType: string; onPick: (p: Pick) => void }) {
  const list = usePagedList<ReviewReport>('admin', listReports, { status, targetType });
  return (
    <ListFrame {...list}>
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className={th}>Reported</th>
            <th className={th}>What</th>
            <th className={th}>Text</th>
            <th className={th}>Why</th>
            <th className={th}>By</th>
            <th className={th}>State</th>
            <th className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {list.rows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">{status === 'open' ? 'Nothing waiting. All reports are settled.' : 'No reports here.'}</td></tr>}
          {list.rows.map((r) => {
            const s = STATE[r.status];
            return (
              <tr key={r.id} className="align-top">
                <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDateTime(r.createdAt)}</td>
                <td className={td}>
                  <span className="font-medium capitalize">{r.targetType}</span>
                  <Link href={`/admin/reviews/${r.reviewId}`} className="block text-xs text-primary hover:underline">Open the review</Link>
                  <span className="block text-xs text-muted-foreground">{r.productName} · {r.sellerName}</span>
                </td>
                <td className={`${td} max-w-xs`}>
                  <span className="line-clamp-3 text-muted-foreground">{r.targetText || '—'}</span>
                  {r.targetStatus === 'hidden' && <span className="text-xs text-amber-700">Already hidden</span>}
                </td>
                <td className={td}>
                  {REASON[r.reason]}
                  {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
                </td>
                <td className={td}>
                  {r.reporterName}
                  <span className="block text-xs capitalize text-muted-foreground">{r.reporterType === 'user' ? 'customer' : r.reporterType}</span>
                </td>
                <td className={td}>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.tone}`}>{s.label}</span>
                  {r.resolvedByName && <span className="block text-xs text-muted-foreground">by {r.resolvedByName}</span>}
                  {r.resolutionNote && <span className="block text-xs text-muted-foreground">{r.resolutionNote}</span>}
                </td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  {r.status === 'open' && (
                    <>
                      <button type="button" className="mr-2 rounded-md bg-destructive px-3 py-1 text-xs font-medium text-white" onClick={() => onPick({ report: r, action: 'hide' })}>Hide</button>
                      <button type="button" className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted" onClick={() => onPick({ report: r, action: 'dismiss' })}>Dismiss</button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ListFrame>
  );
}

/** Reports from customers and sellers, newest first. Open ones wait for a decision. */
export function ReportQueue() {
  const [status, setStatus] = useState('open');
  const [targetType, setTargetType] = useState('');
  const [active, setActive] = useState<Pick | null>(null);
  const [version, setVersion] = useState(0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className={`${field} w-40`} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="resolved_hidden">Hidden</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select className={`${field} w-40`} aria-label="What was reported" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
          <option value="">Reviews and replies</option>
          <option value="review">Reviews</option>
          <option value="reply">Replies</option>
        </select>
      </div>
      <ReportTable key={version} status={status} targetType={targetType} onPick={setActive} />
      {active && (
        <ResolveDialog
          report={active.report}
          action={active.action}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
