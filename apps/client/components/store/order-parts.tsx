'use client';

import { formatDateTime } from '@/lib/datetime';
import { money } from './product-card';
import type { Actor, Attachment, OrderStatus, PaymentStatus } from '@/types/order';

export const ORDER_TEXT: Record<OrderStatus, string> = {
  pending: 'Waiting for the seller',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'On its way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
export const PAYMENT_TEXT: Record<PaymentStatus, string> = {
  due: 'Payment due',
  partially_paid: 'Partly paid',
  paid: 'Paid',
};

const ORDER_TONE: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-sky-100 text-sky-800',
  packed: 'bg-indigo-100 text-indigo-800',
  shipped: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-destructive/10 text-destructive',
};
const PAYMENT_TONE: Record<PaymentStatus, string> = {
  due: 'bg-amber-100 text-amber-800',
  partially_paid: 'bg-sky-100 text-sky-800',
  paid: 'bg-emerald-100 text-emerald-700',
};

export function OrderBadge({ status }: { status: OrderStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_TONE[status]}`}>{ORDER_TEXT[status]}</span>;
}
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PAYMENT_TONE[status]}`}>{PAYMENT_TEXT[status]}</span>;
}

export function actorText(a: Actor) {
  if (a.type === 'user') return a.name ? `${a.name} (you)` : 'You';
  if (a.type === 'seller') return `${a.name ?? 'The seller'} (seller)`;
  if (a.type === 'admin') return `${a.name ?? 'Pigeon Nest'} (Pigeon Nest team)`;
  return a.name ?? 'Unknown';
}

const STEPS: OrderStatus[] = ['pending', 'confirmed', 'packed', 'shipped', 'delivered'];

/** Where the order is on its way to the door. */
export function Progress({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">This order was cancelled.</p>;
  }
  const at = STEPS.indexOf(status);
  return (
    <ol className="flex items-center" aria-label="Order progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 items-center last:flex-none" aria-current={i === at ? 'step' : undefined}>
          <span className="flex flex-col items-center gap-1">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${i <= at ? 'bg-st-teal text-white' : 'bg-st-line text-st-slate'}`}>
              {i < at ? '✓' : i + 1}
            </span>
            <span className={`text-[11px] ${i === at ? 'font-semibold text-st-ink' : 'text-st-slate'}`}>{s === 'pending' ? 'Placed' : s[0].toUpperCase() + s.slice(1)}</span>
          </span>
          {i < STEPS.length - 1 && <span className={`mx-1 mb-4 h-0.5 flex-1 ${i < at ? 'bg-st-teal' : 'bg-st-line'}`} />}
        </li>
      ))}
    </ol>
  );
}

export function Files({ items }: { items: Attachment[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((a) => (
        <li key={a.id}>
          <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-st-line bg-white p-1.5 pr-3 text-xs text-st-ink hover:bg-st-dove">
            {a.kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt="" className="h-10 w-10 rounded object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded bg-st-dove text-[10px] font-semibold uppercase text-st-slate">{a.fileName.split('.').pop()}</span>
            )}
            <span className="max-w-[10rem] truncate">{a.fileName}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function When({ at }: { at: string }) {
  return <>{formatDateTime(at)}</>;
}

export { money };
