'use client';

import type { ReturnDetail } from '@/types/returns';
import { AddRefundRecord } from './refund-actions';
import { RefundRecords } from './refund-records';

/**
 * The money records on a return. The seller's own "returning money" steps stay in the return's history; this holds
 * the extra records an admin adds when the buyer says the money never came. The buyer, seller and admin see the same list.
 */
export function ReturnMoney({ ret, admin, tone = 'staff', onChanged }: { ret: ReturnDetail; admin?: boolean; tone?: 'staff' | 'store'; onChanged?: () => void }) {
  const records = ret.moneyRecords ?? [];
  const canAdd = admin && ['accepted', 'processing', 'returning_money', 'returned'].includes(ret.status);
  if (records.length === 0 && !canAdd) return null;
  const card = tone === 'store' ? 'rounded-xl border border-st-line bg-white p-4 sm:p-5' : 'rounded-xl border border-border bg-card p-4 shadow-sm';
  return (
    <section className={card} aria-label="Money for this return">
      <h2 className={tone === 'store' ? 'font-display mb-2 text-lg font-semibold text-st-ink' : 'mb-2 text-sm font-semibold text-foreground'}>Money records for this return</h2>
      <RefundRecords records={records} tone={tone} empty="No extra money records." />
      {canAdd && onChanged && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-xs text-muted-foreground">If the buyer says the money never came, record what really happened. The amount must be exactly ৳{ret.refundAmount.toLocaleString('en-US')}.</p>
          <AddRefundRecord returnId={ret.id} expected={ret.refundAmount} label="Add a money record" onDone={onChanged} />
        </div>
      )}
    </section>
  );
}
