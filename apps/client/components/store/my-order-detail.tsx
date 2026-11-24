'use client';

import { orderBirdText } from '@/components/products/bird-fields';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { cancelMyOrder, getMyOrder, type MyOrder } from '@/lib/api/customer-orders';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import { formatDateTime } from '@/lib/datetime';
import { ReturnRequest } from './return-request';
import { Files, money, OrderBadge, ORDER_TEXT, actorText, PAYMENT_TEXT, PaymentBadge, Progress } from './order-parts';

const card = 'rounded-xl border border-st-line bg-white p-4 sm:p-5';

export function MyOrderDetail({ id, placed, initial }: { id: number; placed?: boolean; initial?: MyOrder }) {
  const [order, setOrder] = useState<MyOrder | null>(initial ?? null);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>(initial ? 'ready' : 'loading');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrder(await getMyOrder(id));
      setState('ready');
    } catch (e) {
      setState(e instanceof NotFoundApiError ? 'missing' : 'error');
    }
  }, [id]);

  useEffect(() => {
    if (initial) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, initial]);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      setOrder(await cancelMyOrder(id, reason.trim() || undefined));
      setCancelling(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'We could not cancel the order.');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <div className="store-skeleton h-64 rounded-xl bg-st-line" aria-busy="true" />;
  if (state !== 'ready' || !order) {
    return (
      <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold">{state === 'missing' ? 'We can’t find that order' : 'We couldn’t load this order'}</p>
        <p className="mt-1 text-sm text-st-slate">{state === 'missing' ? 'It may belong to another account or browser. Guests can look an order up with its number and phone.' : 'Check your connection and try again.'}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/orders" className="rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Your orders</Link>
          <Link href="/orders/track" className="rounded-full border border-st-line px-5 py-2 text-sm font-semibold text-st-ink hover:bg-st-dove">Track an order</Link>
        </div>
      </div>
    );
  }

  const a = order.address;
  return (
    <div className="space-y-4">
      {placed && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-display text-base font-semibold">Thank you, your order is placed.</p>
          <p className="mt-0.5">
            Order number <strong>{order.orderNumber}</strong>. {order.customer.isGuest ? 'Keep this number and the phone you gave to track the order later.' : 'We will keep you posted here.'}
            {order.paymentStatus === 'due' && order.gateway.slug !== 'cash-on-delivery' && ' The seller will mark it paid once they have checked your payment.'}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-st-ink sm:text-3xl">{order.orderNumber}</h1>
        <OrderBadge status={order.status} />
        <PaymentBadge status={order.paymentStatus} />
        {order.isReturned && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Returned</span>}
      </div>
      <p className="-mt-2 text-sm text-st-slate">Placed {formatDateTime(order.createdAt)} · sold by <Link className="underline" href={`/sellers/${order.seller.id}`}>{order.seller.name}</Link></p>

      <section className={card}>
        <Progress status={order.status} />
        {order.canCancel && !initial && (
          <div className="mt-4 border-t border-st-line pt-3">
            {cancelling ? (
              <div className="space-y-2">
                <p className="text-sm text-st-ink">Cancel this order? The seller hasn’t confirmed it yet, so you can still cancel.</p>
                <input className="w-full rounded-lg border border-st-line px-3 py-2 text-sm focus:border-st-teal focus:outline-none" maxLength={500} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={cancel} className="rounded-full bg-destructive px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Cancelling…' : 'Yes, cancel order'}</button>
                  <button type="button" onClick={() => setCancelling(false)} className="rounded-full border border-st-line px-4 py-1.5 text-sm text-st-ink hover:bg-st-dove">Keep order</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setCancelling(true)} className="text-sm text-st-slate underline-offset-2 hover:text-destructive hover:underline">Cancel this order</button>
            )}
          </div>
        )}
        {!order.canCancel && order.status !== 'cancelled' && order.status !== 'delivered' && (
          <p className="mt-3 border-t border-st-line pt-3 text-xs text-st-slate">The seller has confirmed this order, so it can no longer be cancelled here. Contact the seller if something is wrong.</p>
        )}
      </section>

      <section className={`${card} overflow-x-auto`}>
        <h2 className="font-display mb-2 text-lg font-semibold text-st-ink">Items</h2>
        <ul className="divide-y divide-st-line">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-3 py-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-st-ink-2">
                {i.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-st-ink">{i.productName}</p>
                {i.sku.label && <p className="text-xs text-st-slate">{i.sku.label}</p>}
                {orderBirdText(i.bird).length > 0 && <p className="text-xs text-st-slate">{orderBirdText(i.bird).join(' · ')}</p>}
                <p className="text-xs text-st-slate">{money(i.unitPayable)} × {i.quantity}{i.isReturned && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Returned</span>}</p>
                {i.proposal && (
                  <p className="text-xs text-st-slate">
                    Item price then {money(i.skuUnitPrice)} · your offer {money(i.proposal.unitPrice)}{' '}
                    <Link href={`/proposals/${i.proposal.id}`} className="underline">See offer</Link>
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-st-ink">{money(i.lineTotal)}</p>
                {order.status === 'delivered' && (
                  <Link href={`/reviews?item=${i.id}`} className="mt-1 inline-block text-xs font-medium text-st-teal underline">Write a review</Link>
                )}
              </div>
            </li>
          ))}
        </ul>
        <dl className="ml-auto mt-2 max-w-xs space-y-1 border-t border-st-line pt-2 text-sm">
          <div className="flex justify-between text-st-slate"><dt>Items</dt><dd>{money(order.totals.subtotal)}</dd></div>
          {order.totals.savings > 0 && <div className="flex justify-between text-st-teal"><dt>You saved</dt><dd>{money(order.totals.savings)}</dd></div>}
          <div className="flex justify-between text-st-slate"><dt>Delivery</dt><dd>{order.totals.deliveryCharge > 0 ? money(order.totals.deliveryCharge) : 'Free'}</dd></div>
          <div className="flex justify-between text-base font-semibold text-st-ink"><dt>Total</dt><dd>{money(order.totals.payable)}</dd></div>
          {order.totals.amountPaid > 0 && <div className="flex justify-between text-st-slate"><dt>Paid so far</dt><dd>{money(order.totals.amountPaid)}</dd></div>}
          {order.totals.balanceDue > 0 && order.status !== 'cancelled' && <div className="flex justify-between font-medium text-st-ink"><dt>Still to pay</dt><dd>{money(order.totals.balanceDue)}</dd></div>}
        </dl>
      </section>

      {!initial && <ReturnRequest order={order} />}

      <div className="grid gap-4 md:grid-cols-2">
        <section className={card}>
          <h2 className="font-display mb-1 text-lg font-semibold text-st-ink">Delivery</h2>
          <p className="text-sm text-st-ink">{a.recipientName}</p>
          <p className="text-sm text-st-slate">{a.line}</p>
          <p className="text-sm text-st-slate">{[a.city, a.state, a.postalCode].filter(Boolean).join(', ')}</p>
          <p className="text-sm text-st-slate">{a.countryName}</p>
          <p className="mt-1 text-sm text-st-slate">{a.phone}</p>
          <p className="mt-2 text-xs text-st-slate capitalize">{order.delivery.type}{order.delivery.estimatedDays ? ` · about ${order.delivery.estimatedDays} days` : ''}</p>
          {order.note && <p className="mt-2 text-xs text-st-slate">Your note: {order.note}</p>}
        </section>

        <section className={card}>
          <h2 className="font-display mb-1 text-lg font-semibold text-st-ink">Payment</h2>
          <p className="text-sm text-st-slate">{order.gateway.name} · {PAYMENT_TEXT[order.paymentStatus]}</p>
          <ul className="mt-2 space-y-3">
            {order.payments.map((p) => (
              <li key={p.id} className="text-sm">
                {p.reversal ? (
                  <p className="text-destructive">{money(p.amount)} payment was reversed on {formatDateTime(p.reversal.at)}{p.reversal.reason ? `: ${p.reversal.reason}` : ''}</p>
                ) : (
                  <p className="text-st-ink">{p.status === 'due' ? `${money(p.amount)} due` : `${money(p.amount)} received`}{p.paidAt ? ` on ${formatDateTime(p.paidAt)}` : ''}</p>
                )}
                {p.transactionId && <p className="text-xs text-st-slate">Reference {p.transactionId}</p>}
                {p.description && <p className="text-xs text-st-slate">{p.description}</p>}
                <Files items={p.attachments} />
              </li>
            ))}
          </ul>
          {order.paymentHistory.length > 1 && (
            <ol className="mt-3 space-y-2 border-t border-st-line pt-3">
              {order.paymentHistory.map((h) => (
                <li key={h.id} className="border-l-2 border-st-line pl-3 text-xs text-st-slate">
                  <span className="font-medium text-st-ink">{PAYMENT_TEXT[h.status]}</span>
                  {h.amount > 0 && <> · {money(h.amount)} received</>}
                  {h.amount < 0 && <> · {money(-h.amount)} reversed</>}
                  <span className="block">{actorText(h.by)} · {formatDateTime(h.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {order.updates.length > 0 && (
        <section className={card}>
          <h2 className="font-display mb-2 text-lg font-semibold text-st-ink">Updates from the seller</h2>
          <ul className="space-y-3">
            {order.updates.map((u) => (
              <li key={u.id} className="rounded-lg bg-st-dove/60 p-3 text-sm">
                {u.message && <p className="whitespace-pre-wrap text-st-ink">{u.message}</p>}
                <Files items={u.attachments} />
                <p className="mt-1 text-xs text-st-slate">{actorText(u.by)} · {formatDateTime(u.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <h2 className="font-display mb-2 text-lg font-semibold text-st-ink">History</h2>
        <ol className="space-y-3">
          {[...order.statusHistory].reverse().map((h) => (
            <li key={h.id} className="border-l-2 border-st-line pl-3 text-sm">
              <p className="font-medium text-st-ink">{ORDER_TEXT[h.status]}</p>
              {h.note && <p className="text-st-slate">{h.note}</p>}
              <p className="text-xs text-st-slate">{actorText(h.by)} · {formatDateTime(h.createdAt)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
