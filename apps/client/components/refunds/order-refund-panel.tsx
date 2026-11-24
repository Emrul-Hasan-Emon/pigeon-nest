'use client';

import type { OrderDetail } from '@/types/order';
import { AddRefundRecord, RefundActions } from './refund-actions';
import { RefundBadge, RefundRecords } from './refund-records';

const card = 'rounded-xl border border-border bg-card p-4 shadow-sm';

/**
 * On a staff order page: the money going back to the buyer for a cancelled order, with every record and step. The
 * seller moves it on; an admin can set any status or add another record when the buyer disputes an earlier one.
 */
export function OrderRefundPanel({ role, order, onChanged }: { role: 'admin' | 'seller'; order: OrderDetail; onChanged: () => void }) {
  const records = (order.refunds ?? []).filter((r) => r.kind === 'cancelled_order');
  const cancelledAndPaid = order.status === 'cancelled' && order.totals.amountPaid > 0;
  if (records.length === 0 && !cancelledAndPaid) return null;
  const latest = records.find((r) => r.status !== 'voided');
  return (
    <section className={card} aria-label="Refund">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">Refund of the money paid</h2>
        {order.refundStatus && <RefundBadge status={order.refundStatus} />}
        <span className="text-xs text-muted-foreground">Paid by the buyer: ৳{order.totals.amountPaid.toLocaleString('en-US')}</span>
      </div>
      {records.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No refund record yet.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {latest && (
            <div className="flex flex-wrap gap-2">
              <RefundActions role={role} id={latest.id} status={latest.status} expected={latest.expectedAmount} onDone={onChanged} />
            </div>
          )}
          <RefundRecords records={records} />
        </div>
      )}
      {role === 'admin' && cancelledAndPaid && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-xs text-muted-foreground">If the buyer says an earlier refund never arrived, record what really happened as another record.</p>
          <AddRefundRecord orderId={order.id} expected={order.totals.amountPaid} onDone={onChanged} />
        </div>
      )}
    </section>
  );
}
