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
  OrderStatusBadge,
  PAYMENT_STATUS_LABEL,
  PaymentStatusBadge,
} from './ui';
import { LoadingBlock } from '@/components/ui/skeleton';
import { useBreadcrumbTitle } from '@/components/ui/breadcrumbs';
import { formatMoney } from '@/lib/money';

const card = 'rounded-xl border border-border bg-card p-5 shadow-sm';

export function PaymentDetailView({ role, id }: { role: StaffRole; id: number }) {
  const api = useMemo(() => orderApi(role), [role]);
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  useBreadcrumbTitle(payment ? `Payment #${payment.id}` : null);
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

  const reversed = Boolean(payment.reversal);
  const o = payment.order;
  const summary = reversed
    ? `This payment of ${formatMoney(payment.amount)} was taken back (reversed). It no longer counts as money received.`
    : payment.status === 'due'
      ? `${formatMoney(payment.amount)} is still to be paid by ${payment.customer?.name ?? 'the customer'} (${payment.gateway.name}).`
      : `${formatMoney(payment.amount)} was received${payment.paidAt ? ` on ${formatDateTime(payment.paidAt)}` : ''}, paid by ${payment.gateway.name}.`;

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link href={`${root}/payments`} className="text-base text-primary hover:underline">← All payments</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-foreground">Payment #{payment.id}</h1>
          {reversed ? <span className="rounded-full bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">Taken back</span> : <PaymentStatusBadge status={payment.status} />}
        </div>
      </div>

      <p className={`rounded-xl px-5 py-4 text-lg font-medium ${reversed ? 'bg-destructive/10 text-destructive' : payment.status === 'due' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{summary}</p>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={card}>
          <h2 className="mb-3 text-lg font-semibold text-foreground">The money</h2>
          <dl className="space-y-3">
            <Row label={payment.status === 'due' ? 'Amount to be paid' : 'Amount received'}><span className="text-2xl font-semibold">{formatMoney(payment.amount)}</span></Row>
            <Row label="Paid by">{payment.gateway.name}</Row>
            <Row label="Money received on">{payment.paidAt ? formatDateTime(payment.paidAt) : 'Not received yet'}</Row>
            <Row label="Transaction ID">{payment.transactionId ?? 'None given'}</Row>
          </dl>
        </div>
        <div className={card}>
          <h2 className="mb-3 text-lg font-semibold text-foreground">The order</h2>
          <dl className="space-y-3">
            <Row label="Order number"><Link href={`${root}/orders/${o.id}`} className="text-primary hover:underline">{o.orderNumber}</Link> <span className="text-sm font-normal text-muted-foreground">(tap to open)</span></Row>
            <Row label="Order status"><span className="mr-2 inline-block"><OrderStatusBadge status={o.status} /></span></Row>
            <Row label="Whole order costs">{formatMoney(o.payable)}</Row>
            <Row label="Received so far">{formatMoney(o.amountPaid)}</Row>
            <Row label="Still to pay">{o.balanceDue > 0 ? <span className="text-amber-700">{formatMoney(o.balanceDue)}</span> : <span className="text-emerald-700">Nothing, fully paid</span>}</Row>
          </dl>
        </div>
        <div className={card}>
          <h2 className="mb-3 text-lg font-semibold text-foreground">The customer</h2>
          <dl className="space-y-3">
            <Row label="Name">{payment.customer?.name}{payment.customer?.isGuest && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">Guest</span>}</Row>
            <Row label="Phone">{payment.customer?.phone ?? '—'}</Row>
            {payment.customer?.email && <Row label="Email">{payment.customer.email}</Row>}
            {role === 'admin' && payment.seller && <Row label="Seller">{payment.seller.name}</Row>}
          </dl>
        </div>
      </div>

      {payment.reversal && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <h2 className="mb-1 text-lg font-semibold text-destructive">Why this payment was taken back</h2>
          <p className="text-base text-foreground">{payment.reversal.reason}</p>
          <p className="mt-1 text-sm text-muted-foreground">By {actorLabel(payment.reversal.by)} on {formatDateTime(payment.reversal.at)}.</p>
        </div>
      )}

      {(payment.description || payment.proof || payment.attachments.length > 0) && (
        <div className={card}>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Proof of payment</h2>
          <dl className="space-y-3">
            {payment.recordedBy && <Row label="Written down by">{actorLabel(payment.recordedBy)}</Row>}
            {payment.description && <Row label="Note"><span className="whitespace-pre-wrap font-normal">{payment.description}</span></Row>}
            {payment.proof && Object.entries(payment.proof).map(([k, v]) => <Row key={k} label={`Customer’s ${k}`}>{String(v)}</Row>)}
          </dl>
          {payment.attachments.length > 0 && <p className="mb-1 mt-3 text-base font-semibold text-foreground">Files ({payment.attachments.length})</p>}
          <AttachmentList items={payment.attachments} />
        </div>
      )}

      <div className={card}>
        <h2 className="mb-1 text-lg font-semibold text-foreground">What happened to this order’s payments</h2>
        <p className="mb-3 text-sm text-muted-foreground">Oldest first. The line marked “this payment” is the one you are looking at.</p>
        <ol className="space-y-4">
          {payment.history.map((h) => (
            <li key={h.id} className="border-l-2 border-border pl-4">
              <p className="text-base text-foreground">
                {h.fromStatus ? <>{PAYMENT_STATUS_LABEL[h.fromStatus]} → </> : null}<strong>{PAYMENT_STATUS_LABEL[h.status]}</strong>
                {h.paymentId === payment.id && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-sm text-primary">this payment</span>}
              </p>
              {h.amount > 0 && <p className="text-base text-foreground">{formatMoney(h.amount)} received. {formatMoney(h.amountPaidAfter)} received in all.</p>}
              {h.amount < 0 && <p className="text-base text-destructive">{formatMoney(-h.amount)} taken back. {formatMoney(h.amountPaidAfter)} left in all.</p>}
              {h.note && <p className="text-base text-muted-foreground">Note: {h.note}</p>}
              <p className="text-sm text-muted-foreground">{actorLabel(h.by)} · {formatDateTime(h.createdAt)}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium text-foreground">{children}</dd>
    </div>
  );
}
