'use client';

import { formatDateTime } from '@/lib/datetime';
import { REFUND_STATUS_WORD, type RefundRecord, type RefundStatus } from '@/types/refund';
import { formatMoney } from '@/lib/money';


export function RefundBadge({ status }: { status: RefundStatus }) {
  const tone = status === 'refunded' ? 'bg-emerald-100 text-emerald-800' : status === 'processing' ? 'bg-sky-100 text-sky-900' : status === 'needs_to_refund' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-600';
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{REFUND_STATUS_WORD[status]}</span>;
}

/**
 * Every refund record on an order or a return, with its steps. The buyer, the seller and the admin all read this
 * same list: who did what, when, how much, with the note and the proof.
 */
export function RefundRecords({ records, empty, tone = 'staff' }: { records: RefundRecord[]; empty?: string; tone?: 'staff' | 'store' }) {
  const muted = tone === 'store' ? 'text-st-slate' : 'text-muted-foreground';
  const ink = tone === 'store' ? 'text-st-ink' : 'text-foreground';
  const line = tone === 'store' ? 'border-st-line' : 'border-border';
  if (records.length === 0) return empty ? <p className={`text-sm ${muted}`}>{empty}</p> : null;
  return (
    <ul className="space-y-3">
      {records.map((r, i) => (
        <li key={r.id} className={`rounded-lg border ${line} p-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-semibold ${ink}`}>{r.kind === 'return' ? 'Money for a return' : 'Refund'} #{r.id}{i === 0 && records.length > 1 ? ' (latest)' : ''}</span>
            <RefundBadge status={r.status} />
            <span className={`text-xs ${muted}`}>{formatDateTime(r.createdAt)}</span>
          </div>
          <p className={`mt-1 text-sm ${ink}`}>
            To refund: <span className="font-semibold">{formatMoney(r.expectedAmount)}</span>
            {r.status === 'refunded' && r.amount !== null && <> · Sent back: <span className="font-semibold">{formatMoney(r.amount)}</span>{r.refundedAt ? ` on ${formatDateTime(r.refundedAt)}` : ''}{r.refundedByName ? ` by ${r.refundedByName}` : ''}</>}
          </p>
          {r.transactionId && <p className={`text-xs ${muted}`}>Transaction {r.transactionId}</p>}
          {r.proof.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-2">
              {r.proof.map((p) => (
                <li key={p.fileUrl}><a href={p.fileUrl} target="_blank" rel="noreferrer" className={`inline-block rounded-md border ${line} px-2 py-0.5 text-xs font-medium ${tone === 'store' ? 'text-st-teal' : 'text-primary'} hover:underline`}>{p.kind === 'image' ? 'View proof' : p.fileName}</a></li>
              ))}
            </ul>
          )}
          <ol className={`mt-2 space-y-1.5 border-l-2 ${line} pl-3`}>
            {r.history.map((h) => (
              <li key={h.id} className={`text-xs ${muted}`}>
                <span className={`font-semibold ${ink}`}>{REFUND_STATUS_WORD[h.status]}</span>
                {h.amount !== null && <> · {formatMoney(h.amount)}</>}
                <span className="block">{h.by ?? 'System'} · {formatDateTime(h.createdAt)}</span>
                {h.note && <span className="block whitespace-pre-wrap">{h.note}</span>}
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ul>
  );
}
