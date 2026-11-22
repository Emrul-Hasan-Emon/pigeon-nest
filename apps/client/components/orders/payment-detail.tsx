'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { NotFoundApiError } from '@/lib/api/http';
import { orderApi } from '@/lib/api/orders';
import { formatDateTime } from '@/lib/datetime';
import type { PaymentDetail, StaffRole } from '@/types/order';
import {
  actorLabel,
  AttachmentList,
  base,
  money,
  OrderStatusBadge,
  PAYMENT_STATUS_LABEL,
  PaymentStatusBadge,
} from './ui';
import { LoadingBlock } from '@/components/ui/skeleton';

const card = 'rounded-xl border border-border bg-card p-5 shadow-sm';

export function PaymentDetailView({ role, id }: { role: StaffRole; id: number }) {
  const api = useMemo(() => orderApi(role), [role]);
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const root = base(role);

  useEffect(() => {
    let cancelled = false;
    api.paymentDetail(id)
      .then((p) => {
        if (cancelled) return;
        setPayment(p);
        setState('ready');
      })
      .catch((e) => !cancelled && setState(e instanceof NotFoundApiError ? 'missing' : 'error'));
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  if (state === 'loading') return <LoadingBlock />;
  if (state !== 'ready' || !payment) {
    return (
      <div className="py-10 text-center">
        <p className="text-foreground">{state === 'missing' ? 'That payment does not exist.' : 'Failed to load the payment.'}</p>
        <Link href={`${root}/payments`} className="mt-3 inline-block text-primary hover:underline">Back to payments</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link href={`${root}/payments`} className="text-sm text-primary hover:underline">← Payments</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Payment #{payment.id}</h1>
          {payment.reversal ? <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">Reversed</span> : <PaymentStatusBadge status={payment.status} />}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={card}>
          <p className="text-xs text-muted-foreground">{payment.status === 'due' ? 'Expected' : 'Received'}</p>
          <p className="text-xl font-semibold text-foreground">{money(payment.amount)}</p>
          <p className="text-sm text-muted-foreground">via {payment.gateway.name}</p>
          {payment.paidAt && <p className="text-xs text-muted-foreground">Paid {formatDateTime(payment.paidAt)}</p>}
          {payment.transactionId && <p className="mt-1 text-sm text-foreground">Transaction {payment.transactionId}</p>}
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">Order</p>
          <Link href={`${root}/orders/${payment.order.id}`} className="font-medium text-primary hover:underline">{payment.order.orderNumber}</Link>
          <div className="mt-1 flex gap-2"><OrderStatusBadge status={payment.order.status} /><PaymentStatusBadge status={payment.order.paymentStatus} /></div>
          <p className="mt-2 text-sm text-muted-foreground">Payable {money(payment.order.payable)} · received {money(payment.order.amountPaid)} · due {money(payment.order.balanceDue)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">Customer</p>
          <p className="font-medium text-foreground">{payment.customer?.name}{payment.customer?.isGuest && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">Guest</span>}</p>
          <p className="text-sm text-muted-foreground">{payment.customer?.phone}</p>
          {payment.customer?.email && <p className="text-sm text-muted-foreground">{payment.customer.email}</p>}
          {role === 'admin' && payment.seller && <p className="mt-2 text-sm text-muted-foreground">Seller: {payment.seller.name}</p>}
        </div>
      </div>

      {payment.reversal && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
          <h2 className="mb-1 font-semibold text-destructive">This payment was reversed</h2>
          <p className="text-foreground">{payment.reversal.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">{actorLabel(payment.reversal.by)} · {formatDateTime(payment.reversal.at)}. It no longer counts towards what the order has received.</p>
        </div>
      )}

      {(payment.description || payment.proof || payment.attachments.length > 0) && (
        <div className={card}>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Proof of payment</h2>
          {payment.recordedBy && <p className="text-xs text-muted-foreground">Recorded by {actorLabel(payment.recordedBy)}</p>}
          {payment.description && <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{payment.description}</p>}
          {payment.proof && <p className="mt-1 text-sm text-muted-foreground">Customer details: {Object.entries(payment.proof).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>}
          <AttachmentList items={payment.attachments} />
        </div>
      )}

      <div className={card}>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Payment history of this order</h2>
        <ol className="space-y-3">
          {payment.history.map((h) => (
            <li key={h.id} className="border-l-2 border-border pl-3 text-sm">
              <p className="text-foreground">
                {h.fromStatus ? <>{PAYMENT_STATUS_LABEL[h.fromStatus]} → </> : null}<strong>{PAYMENT_STATUS_LABEL[h.status]}</strong>
                {h.amount > 0 && <span className="text-muted-foreground"> · {money(h.amount)} received, {money(h.amountPaidAfter)} in total</span>}
                {h.amount < 0 && <span className="text-destructive"> · {money(-h.amount)} reversed, {money(h.amountPaidAfter)} left in total</span>}
                {h.paymentId === payment.id && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">this payment</span>}
              </p>
              {h.note && <p className="text-muted-foreground">{h.note}</p>}
              <p className="text-xs text-muted-foreground">{actorLabel(h.by)} · {formatDateTime(h.createdAt)}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
