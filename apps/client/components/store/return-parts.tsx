import { Files, money } from './order-parts';
import { formatDateTime } from '@/lib/datetime';
import type { ReturnHistoryEntry, ReturnStatus } from '@/types/returns';

export { money };

export const RETURN_TEXT: Record<ReturnStatus, string> = {
  return_requested: 'Waiting for the seller',
  accepted: 'Accepted: send the items back',
  rejected: 'Rejected',
  processing: 'Seller is processing it',
  returning_money: 'Money is on its way back',
  returned: 'Returned and refunded',
  cancelled: 'Cancelled',
};

const TONE: Record<ReturnStatus, string> = {
  return_requested: 'bg-amber-100 text-amber-800',
  accepted: 'bg-sky-100 text-sky-800',
  rejected: 'bg-red-100 text-red-700',
  processing: 'bg-indigo-100 text-indigo-800',
  returning_money: 'bg-violet-100 text-violet-800',
  returned: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-st-dove text-st-slate',
};

export function ReturnStateBadge({ status }: { status: ReturnStatus }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[status]}`}>{RETURN_TEXT[status]}</span>;
}

function by(h: ReturnHistoryEntry) {
  if (h.by.type === 'seller') return `Seller ${h.by.name ?? ''}`.trim();
  if (h.by.type === 'admin') return 'Pigeon Nest support';
  return 'You';
}

/** Every step of the return, oldest first, with the seller's notes and proof. */
export function ReturnSteps({ history }: { history: ReturnHistoryEntry[] }) {
  return (
    <ol className="space-y-4 border-l border-st-line pl-4">
      {history.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-st-teal" />
          <p className="text-sm text-st-ink"><strong className="font-medium">{RETURN_TEXT[h.status]}</strong> <span className="text-st-slate">· {by(h)}</span></p>
          {h.note && <p className="mt-0.5 whitespace-pre-wrap rounded-lg bg-st-dove/60 px-3 py-1.5 text-sm text-st-ink">“{h.note}”</p>}
          <Files items={h.attachments} />
          <p className="mt-1 text-xs text-st-slate">{formatDateTime(h.createdAt)}</p>
        </li>
      ))}
    </ol>
  );
}
