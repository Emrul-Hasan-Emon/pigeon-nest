import Link from 'next/link';
import { AttachmentList, money } from '@/components/orders/ui';
import { formatDateTime } from '@/lib/datetime';
import type { ReturnHistoryEntry, ReturnItemView, ReturnScope, ReturnStatus } from '@/types/returns';

export const RETURN_LABEL: Record<ReturnStatus, string> = {
  return_requested: 'Requested',
  accepted: 'Accepted',
  rejected: 'Rejected',
  processing: 'Processing',
  returning_money: 'Returning money',
  returned: 'Returned',
  cancelled: 'Cancelled',
};

export const SCOPE_LABEL: Record<ReturnScope, string> = { full_order: 'Whole order', items: 'Items' };

const TONE: Record<ReturnStatus, string> = {
  return_requested: 'bg-amber-100 text-amber-800',
  accepted: 'bg-sky-100 text-sky-800',
  rejected: 'bg-destructive/10 text-destructive',
  processing: 'bg-indigo-100 text-indigo-800',
  returning_money: 'bg-violet-100 text-violet-800',
  returned: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-muted text-muted-foreground',
};

export function ReturnBadge({ status }: { status: ReturnStatus }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[status]}`}>{RETURN_LABEL[status]}</span>;
}

function who(by: { name: string | null; type: string | null }) {
  const kind = by.type === 'user' ? 'customer' : by.type;
  return `${by.name ?? 'Unknown'}${kind ? ` (${kind})` : ''}`;
}

/** Every move of the return, oldest first, with the notes and proof files. */
export function ReturnTimeline({ history }: { history: ReturnHistoryEntry[] }) {
  return (
    <ol className="space-y-4 border-l border-border pl-4">
      {history.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
          <p className="text-sm text-foreground">
            <strong className="font-medium">{RETURN_LABEL[h.status]}</strong>
            {h.fromStatus && <span className="text-muted-foreground"> (was {RETURN_LABEL[h.fromStatus].toLowerCase()})</span>}
            <span className="text-muted-foreground"> · {who(h.by)}</span>
          </p>
          {h.note && <p className="mt-0.5 whitespace-pre-wrap rounded-md bg-muted px-2 py-1 text-sm text-foreground">“{h.note}”</p>}
          <AttachmentList items={h.attachments} />
          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</p>
        </li>
      ))}
    </ol>
  );
}

/** The lines of a return: what is refunded for each and, for staff, the commission that comes back. */
export function ReturnItemsTable({ items, showCommission }: { items: ReturnItemView[]; showCommission: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Item</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Qty</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Refund</th>
            {showCommission && <th className="px-3 py-2 text-left font-medium text-muted-foreground">Commission back</th>}
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Returned</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((i) => (
            <tr key={i.id}>
              <td className="px-3 py-2">
                <span className="text-foreground">{i.productName}</span>
                {i.skuLabel && <span className="block text-xs text-muted-foreground">{i.skuLabel}</span>}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{i.quantity}</td>
              <td className="px-3 py-2 font-medium text-foreground">{money(i.refundAmount)}</td>
              {showCommission && <td className="px-3 py-2 text-muted-foreground">{money(i.commissionAmount ?? 0)}</td>}
              <td className="px-3 py-2 text-muted-foreground">{i.isReturned ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrderLink({ role, order }: { role: 'admin' | 'seller'; order: { id: number; orderNumber: string | null } }) {
  return <Link className="text-primary hover:underline" href={`/${role}/orders/${order.id}`}>{order.orderNumber ?? `#${order.id}`}</Link>;
}
