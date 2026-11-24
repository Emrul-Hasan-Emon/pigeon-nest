'use client';

import { RefundBadge, RefundRecords } from '@/components/refunds/refund-records';
import type { OrderDetail } from '@/types/order';

const card = 'rounded-xl border border-st-line bg-white p-4 sm:p-5';

/** On the buyer's order page: where the money for a cancelled order stands. The seller and the admin see the same steps. */
export function OrderRefund({ order }: { order: OrderDetail }) {
  const records = (order.refunds ?? []).filter((r) => r.kind === 'cancelled_order');
  if (records.length === 0) return null;
  const status = order.refundStatus;
  return (
    <section className={card} aria-labelledby="refund-title">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 id="refund-title" className="font-display text-lg font-semibold text-st-ink">Your refund</h2>
        {status && <RefundBadge status={status} />}
      </div>
      <p className="mb-3 text-sm text-st-slate">
        {status === 'refunded'
          ? 'The money was sent back to you. Look at the proof below. If you have not received it, contact the seller or the marketplace and an admin will check.'
          : status === 'processing'
            ? 'The seller is sending your money back.'
            : 'This order was cancelled, so the money you paid goes back to you. The seller will send it and show proof here.'}
      </p>
      <RefundRecords records={records} tone="store" />
    </section>
  );
}
