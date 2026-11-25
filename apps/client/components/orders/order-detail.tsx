'use client';

import { orderBirdText } from '@/components/products/bird-fields';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Printer } from 'lucide-react';
import { OrderRefundPanel } from '@/components/refunds/order-refund-panel';
import { OrderClaimsPanel } from '@/components/payments/order-claims-panel';
import { ReturnBadge } from '@/components/returns/parts';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { NotFoundApiError } from '@/lib/api/http';
import { orderApi } from '@/lib/api/orders';
import { formatDateTime, fromLocalInput } from '@/lib/datetime';
import type { OrderDetail, OrderPayment, OrderStatus, StaffRole } from '@/types/order';
import {
  actorLabel,
  AttachmentList,
  base,
  field,
  FilePicker,
  money,
  ORDER_STATUS_LABEL,
  OrderStatusBadge,
  outlineButton,
  PAYMENT_STATUS_LABEL,
  PaymentStatusBadge,
  primaryButton,
  useApiError,
} from './ui';
import { LoadingBlock } from '@/components/ui/skeleton';
import { useBreadcrumbTitle } from '@/components/ui/breadcrumbs';

const card = 'rounded-xl border border-border bg-card p-5 shadow-sm';

export function OrderDetailView({ role, id }: { role: StaffRole; id: number }) {
  const api = useMemo(() => orderApi(role), [role]);
  const errorMessage = useApiError(role);
  const { showToast } = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  useBreadcrumbTitle(order?.orderNumber);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const root = base(role);

  const load = useCallback(async () => {
    try {
      setOrder(await api.detail(id));
      setState('ready');
    } catch (e) {
      setState(e instanceof NotFoundApiError ? 'missing' : 'error');
    }
  }, [api, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (state === 'loading') return <LoadingBlock />;
  if (state !== 'ready' || !order) {
    return (
      <div className="py-10 text-center">
        <p className="text-foreground">{state === 'missing' ? 'That order does not exist.' : 'Failed to load the order.'}</p>
        <Link href={`${root}/orders`} className="mt-3 inline-block text-primary hover:underline">Back to orders</Link>
      </div>
    );
  }

  const fail = (e: unknown, fallback: string) => showToast(errorMessage(e, fallback), 'error');

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <Link href={`${root}/orders`} className="text-sm text-primary hover:underline">← Orders</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
          {order.isReturned && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Fully returned</span>}
        </div>
        <p className="text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`${root}/orders/${order.id}/print?type=invoice`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">
            <Printer aria-hidden="true" className="h-4 w-4" />
            Print invoice
          </Link>
          <Link href={`${root}/orders/${order.id}/print?type=slip`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">
            <Printer aria-hidden="true" className="h-4 w-4" />
            Print packing slip
          </Link>
        </div>
      </div>

      <StatusPanel role={role} order={order} onChanged={(o) => { setOrder(o); showToast(`Order is now ${ORDER_STATUS_LABEL[o.status].toLowerCase()}.`, 'success'); }} onError={fail} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className={card}>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Customer</h2>
          <p className="font-medium text-foreground">
            {role === 'admin' && (order.customer.userId ?? order.account?.id)
              ? <Link className="font-medium text-primary underline underline-offset-2 hover:opacity-70" href={`/admin/users/${order.customer.userId ?? order.account?.id}`}>{order.customer.name}</Link>
              : order.customer.name}
          </p>
          <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
          {order.customer.email && <p className="text-sm text-muted-foreground">{order.customer.email}</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            {order.account
              ? <>Account: {role === 'admin' ? <Link className="text-primary hover:underline" href={`/admin/users/${order.account.id}`}>{order.account.name}</Link> : order.account.name}</>
              : 'Guest or walk-in customer, no account'}
          </p>
        </div>
        <div className={card}>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Deliver to</h2>
          <p className="text-sm text-foreground">{order.address.recipientName}</p>
          <p className="text-sm text-muted-foreground">{order.address.line}</p>
          <p className="text-sm text-muted-foreground">
            {[order.address.city, order.address.state, order.address.postalCode].filter(Boolean).join(', ')}
          </p>
          <p className="text-sm text-muted-foreground">{order.address.countryName}</p>
        </div>
        <div className={card}>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Delivery and seller</h2>
          <p className="text-sm capitalize text-foreground">{order.delivery.type}{order.delivery.estimatedDays ? `, about ${order.delivery.estimatedDays} days` : ''}</p>
          {order.delivery.zoneName && <p className="text-xs text-muted-foreground">Zone: {order.delivery.zoneName}</p>}
          <p className="mt-2 text-sm text-muted-foreground">Seller: {role === 'admin' ? <Link className="font-medium text-primary underline underline-offset-2 hover:opacity-70" href={`/admin/sellers/${order.seller.id}`}>{order.seller.name}</Link> : order.seller.name}</p>
          <p className="text-sm text-muted-foreground">Pays by: {order.gateway.name}</p>
          {order.cartId && role === 'admin' && <Link className="text-xs text-primary hover:underline" href={`/admin/carts/${order.cartId}`}>Cart #{order.cartId}</Link>}
        </div>
      </div>
      {order.note && (
        <div className={card}>
          <h2 className="mb-1 text-sm font-semibold text-foreground">Customer note</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{order.note}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>{['Product', 'Variant', 'Qty', 'Unit price', 'Line total', ...(order.commission ? ['System commission'] : [])].map((h) => <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {order.items.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {i.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                    )}
                    {role === 'admin'
                      ? <Link className="font-medium text-primary underline underline-offset-2 hover:opacity-70" href={`/admin/catalog/products/${i.productId}`}>{i.productName}</Link>
                      : <span className="font-medium text-foreground">{i.productName}</span>}
                    {i.isReturned && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Returned</span>}
                  </div>
                  {orderBirdText(i.bird).length > 0 && <p className="mt-1 text-xs text-muted-foreground">{orderBirdText(i.bird).join(' · ')}</p>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{i.sku.label || i.sku.code}<span className="block text-xs">{i.sku.code}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{i.quantity}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {money(i.unitPayable)}
                  {i.proposal ? (
                    <span className="block text-xs">
                      Item price then {money(i.skuUnitPrice)}
                      <br />
                      Proposal price {money(i.proposal.unitPrice)}
                    </span>
                  ) : (
                    i.unitPrice !== i.unitPayable && <s className="ml-1 text-xs">{money(i.unitPrice)}</s>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{money(i.lineTotal)}</td>
                {order.commission && <td className="px-4 py-3 text-muted-foreground">{money(i.systemCommission ?? 0)}<span className="block text-xs">seller keeps {money(i.sellerAmount ?? 0)}</span></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground"><dt>Items</dt><dd>{money(order.totals.subtotal)}</dd></div>
        {order.totals.savings > 0 && <div className="flex justify-between text-muted-foreground"><dt>Discounts already applied</dt><dd>{money(order.totals.savings)}</dd></div>}
        <div className="flex justify-between text-muted-foreground"><dt>Delivery</dt><dd>{money(order.totals.deliveryCharge)}</dd></div>
        <div className="flex justify-between border-t border-border pt-1 text-base font-semibold text-foreground"><dt>Payable</dt><dd>{money(order.totals.payable)}</dd></div>
        <div className="flex justify-between text-muted-foreground"><dt>Received</dt><dd>{money(order.totals.amountPaid)}</dd></div>
        <div className="flex justify-between font-medium text-foreground"><dt>Balance due</dt><dd>{money(order.totals.balanceDue)}</dd></div>
        {order.commission && (
          <>
            <div className="flex justify-between border-t border-border pt-1 text-muted-foreground"><dt>System commission{order.commission.type && ` (${order.commission.type === 'percentage' ? `${order.commission.value}% of items` : 'fixed per item'})`}</dt><dd>{money(order.commission.systemCommission)}</dd></div>
            <div className="flex justify-between text-muted-foreground"><dt>Seller amount</dt><dd>{money(order.commission.sellerAmount)}</dd></div>
          </>
        )}
      </dl>

      <ReturnsPanel role={role} order={order} />

      <OrderRefundPanel role={role} order={order} onChanged={load} />

      <OrderClaimsPanel role={role} order={order} onChanged={load} />

      <PaymentPanel role={role} order={order} onChanged={() => { showToast('Payment recorded.', 'success'); load(); }} onError={fail} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className={card}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Payment history</h2>
          <ol className="space-y-3">
            {order.paymentHistory.map((h) => (
              <li key={h.id} className="border-l-2 border-border pl-3 text-sm">
                <p className="text-foreground">
                  {h.fromStatus ? <>{PAYMENT_STATUS_LABEL[h.fromStatus]} → </> : null}<strong>{PAYMENT_STATUS_LABEL[h.status]}</strong>
                  {h.amount > 0 && <span className="text-muted-foreground"> · {money(h.amount)} received, {money(h.amountPaidAfter)} in total</span>}
                  {h.amount < 0 && <span className="text-destructive"> · {money(-h.amount)} reversed, {money(h.amountPaidAfter)} left in total</span>}
                </p>
                {h.note && <p className="text-muted-foreground">{h.note}</p>}
                <p className="text-xs text-muted-foreground">{actorLabel(h.by)} · {formatDateTime(h.createdAt)}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className={card}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Order history</h2>
          <ol className="space-y-3">
            {order.statusHistory.map((h) => (
              <li key={h.id} className="border-l-2 border-border pl-3 text-sm">
                <p className="text-foreground">
                  {h.fromStatus ? <>{ORDER_STATUS_LABEL[h.fromStatus]} → </> : null}<strong>{ORDER_STATUS_LABEL[h.status]}</strong>
                </p>
                {h.note && <p className="text-muted-foreground">{h.note}</p>}
                <p className="text-xs text-muted-foreground">{actorLabel(h.by)} · {formatDateTime(h.createdAt)}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <UpdatesPanel role={role} order={order} onPosted={() => { showToast('Update posted.', 'success'); load(); }} onError={fail} />
    </div>
  );
}

/** Returns on this order, with a way for an admin to open one. */
function ReturnsPanel({ role, order }: { role: StaffRole; order: OrderDetail }) {
  const canOpen = role === 'admin' && order.status === 'delivered' && order.paymentStatus === 'paid' && !order.isReturned;
  if (order.returns.length === 0 && !canOpen) return null;
  return (
    <div className={card}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Returns</h2>
        {canOpen && <Link href={`/admin/returns/new?orderId=${order.id}`} className="text-sm text-primary hover:underline">Open a return</Link>}
      </div>
      {order.returns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No returns on this order.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {order.returns.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <Link className="font-medium text-primary hover:underline" href={`${base(role)}/returns/${r.id}`}>{r.returnNumber}</Link>
              <span className="text-muted-foreground">{r.scope === 'full_order' ? 'Whole order' : `${r.orderItemIds.length} item${r.orderItemIds.length === 1 ? '' : 's'}`} · refund {money(r.refundAmount)}</span>
              <ReturnBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPanel({
  role,
  order,
  onChanged,
  onError,
}: {
  role: StaffRole;
  order: OrderDetail;
  onChanged: (order: OrderDetail) => void;
  onError: (e: unknown, fallback: string) => void;
}) {
  const api = useMemo(() => orderApi(role), [role]);
  const [target, setTarget] = useState<OrderStatus | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function apply() {
    if (!target) return;
    setBusy(true);
    try {
      const updated = await api.changeStatus(order.id, target, note.trim() || undefined);
      setTarget('');
      setNote('');
      onChanged(updated);
    } catch (e) {
      onError(e, 'Failed to change the status.');
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  if (order.allowedStatuses.length === 0) {
    return (
      <div className={card}>
        <h2 className="text-sm font-semibold text-foreground">Order status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This order is {ORDER_STATUS_LABEL[order.status].toLowerCase()}. {role === 'seller' ? 'Only an admin can change it now.' : ''}
        </p>
      </div>
    );
  }

  return (
    <div className={card}>
      <h2 className="text-sm font-semibold text-foreground">Change order status</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {role === 'seller'
          ? 'Confirm or cancel a new order, then pack, ship and deliver it. After you confirm, only an admin can cancel.'
          : 'As an admin you can move the order to any status. Cancelling puts the stock back; reopening takes it again.'}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Move to
          <select className={`${field} mt-0.5 block`} value={target} onChange={(e) => setTarget(e.target.value as OrderStatus)}>
            <option value="">Choose a status</option>
            {order.allowedStatuses.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="min-w-[14rem] flex-1 text-xs text-muted-foreground">
          Note (everyone on the order sees it)
          <input className={`${field} mt-0.5 block w-full`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </label>
        <button type="button" disabled={!target || busy} className={primaryButton} onClick={() => (target === 'cancelled' ? setConfirm(true) : apply())}>
          {busy ? 'Saving…' : 'Update status'}
        </button>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Cancel this order?"
          description={role === 'seller' ? 'The stock goes back on the shelf and the customer is told. Once cancelled, only an admin can reopen it.' : 'The stock goes back on the shelf and the customer is told.'}
          confirmLabel="Cancel order"
          onConfirm={apply}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

function PaymentPanel({
  role,
  order,
  onChanged,
  onError,
}: {
  role: StaffRole;
  order: OrderDetail;
  onChanged: () => void;
  onError: (e: unknown, fallback: string) => void;
}) {
  const api = useMemo(() => orderApi(role), [role]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reversing, setReversing] = useState<OrderPayment | null>(null);
  const [reason, setReason] = useState('');
  const [reverseBusy, setReverseBusy] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);
  const canRecord = order.status !== 'cancelled' && order.totals.balanceDue > 0;
  // A seller can only undo what a seller recorded; an admin can undo anything.
  const canReverse = (p: OrderPayment) => p.status !== 'due' && !p.reversal && (role === 'admin' || p.recordedBy?.type === 'seller');

  async function reverse() {
    if (!reversing) return;
    if (reason.trim().length < 3) return setReverseError('Say why the payment is being reversed (at least 3 characters).');
    setReverseBusy(true);
    setReverseError(null);
    try {
      await api.reversePayment(order.id, reversing.id, reason.trim());
      setReversing(null);
      setReason('');
      onChanged();
    } catch (err) {
      setReverseError(err instanceof Error ? err.message : 'Failed to reverse the payment.');
      onError(err, 'Failed to reverse the payment.');
    } finally {
      setReverseBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (description.trim().length < 3) return setFormError('Describe how the payment was made (at least 3 characters).');
    if (files.length === 0) return setFormError('Attach at least one image or file as proof.');
    if (amount.trim() !== '' && !(Number(amount) > 0)) return setFormError('Enter an amount above 0, or leave it empty to record the whole balance.');
    setBusy(true);
    try {
      await api.recordPayment(
        order.id,
        { description: description.trim(), amount: amount.trim() || undefined, transactionId: transactionId.trim() || undefined, paidAt: paidAt ? fromLocalInput(paidAt) : undefined },
        files,
      );
      setAmount(''); setDescription(''); setTransactionId(''); setPaidAt(''); setFiles([]);
      onChanged();
    } catch (err) {
      onError(err, 'Failed to record the payment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <h2 className="text-sm font-semibold text-foreground">Payments</h2>
      {order.payments.length === 0 && <p className="mt-1 text-sm text-muted-foreground">No payments yet.</p>}
      <ul className="mt-2 divide-y divide-border">
        {order.payments.map((p) => (
          <li key={p.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {p.reversal ? (
                <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">Reversed</span>
              ) : (
                <PaymentStatusBadge status={p.status} />
              )}
              <span className={`font-medium ${p.reversal ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                {p.status === 'due' && !p.reversal ? `${money(p.amount)} expected` : `${money(p.amount)} received`}
              </span>
              <span className="text-muted-foreground">via {p.gateway.name}</span>
              {p.paidAt && <span className="text-xs text-muted-foreground">on {formatDateTime(p.paidAt)}</span>}
              {canReverse(p) && (
                <button type="button" onClick={() => { setReversing(p); setReason(''); setReverseError(null); }} className="ml-auto text-xs text-destructive hover:underline">
                  Reverse payment
                </button>
              )}
            </div>
            {p.recordedBy && <p className="mt-1 text-xs text-muted-foreground">Recorded by {actorLabel(p.recordedBy)}</p>}
            {p.transactionId && <p className="mt-1 text-muted-foreground">Transaction: {p.transactionId}</p>}
            {p.proof && (
              <p className="mt-1 text-muted-foreground">
                Customer details: {Object.entries(p.proof).map(([k, v]) => `${k}: ${v}`).join(', ')}
              </p>
            )}
            {p.description && <p className="mt-1 text-foreground">{p.description}</p>}
            <AttachmentList items={p.attachments} />
            {p.reversal && (
              <p className="mt-2 rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive">
                Reversed by {actorLabel(p.reversal.by)} on {formatDateTime(p.reversal.at)}: {p.reversal.reason}
              </p>
            )}
          </li>
        ))}
      </ul>

      {canRecord ? (
        <form onSubmit={submit} className="mt-4 space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Mark as paid</h3>
          <p className="text-xs text-muted-foreground">
            Balance due: <strong>{money(order.totals.balanceDue)}</strong>. Leave the amount empty to record the whole balance, or enter a smaller amount for a part payment. A description and at least one file are required.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <input className={field} inputMode="decimal" placeholder={`Amount (default ${money(order.totals.balanceDue)})`} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input className={field} maxLength={100} placeholder="Transaction ID (optional)" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
            <input className={field} type="datetime-local" aria-label="When it was paid" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <textarea className={`${field} w-full`} rows={2} maxLength={1000} placeholder="How was it paid? e.g. PayPal to the shop email, cash at pickup" value={description} onChange={(e) => setDescription(e.target.value)} />
          <FilePicker files={files} onChange={setFiles} />
          {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          <button type="submit" disabled={busy} className={primaryButton}>{busy ? 'Saving…' : 'Record payment'}</button>
        </form>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
          {order.status === 'cancelled' ? 'A cancelled order cannot take a payment.' : 'This order is fully paid.'}
        </p>
      )}
      {reversing && (
        <Modal title="Reverse this payment?" onClose={() => setReversing(null)} widthClassName="max-w-md">
          <p className="text-sm text-muted-foreground">
            {money(reversing.amount)} will be taken off what the order has received. The payment stays on record as reversed, with your reason, and the payment history gets a line.
          </p>
          <textarea className={`${field} mt-3 w-full`} rows={3} maxLength={1000} placeholder="Why? e.g. the transfer never arrived" value={reason} onChange={(e) => setReason(e.target.value)} />
          {reverseError && <p role="alert" className="mt-2 text-sm text-destructive">{reverseError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={outlineButton} onClick={() => setReversing(null)}>Keep payment</button>
            <button type="button" disabled={reverseBusy} className={primaryButton} onClick={reverse}>{reverseBusy ? 'Reversing…' : 'Reverse payment'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function UpdatesPanel({
  role,
  order,
  onPosted,
  onError,
}: {
  role: StaffRole;
  order: OrderDetail;
  onPosted: () => void;
  onError: (e: unknown, fallback: string) => void;
}) {
  const api = useMemo(() => orderApi(role), [role]);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.postUpdate(order.id, message.trim(), files);
      setMessage('');
      setFiles([]);
      onPosted();
    } catch (err) {
      onError(err, 'Failed to post the update.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <h2 className="text-sm font-semibold text-foreground">Updates</h2>
      <p className="text-xs text-muted-foreground">The customer, the seller and the admin all see these.</p>
      {order.updates.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No updates yet.</p>}
      <ul className="mt-3 space-y-3">
        {order.updates.map((u) => (
          <li key={u.id} className="rounded-md bg-muted/50 p-3 text-sm">
            {u.message && <p className="whitespace-pre-wrap text-foreground">{u.message}</p>}
            <AttachmentList items={u.attachments} />
            <p className="mt-1 text-xs text-muted-foreground">{actorLabel(u.by)} · {formatDateTime(u.createdAt)}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-4 space-y-3 border-t border-border pt-4">
        <textarea className={`${field} w-full`} rows={2} maxLength={2000} placeholder="Write an update, or attach a file" value={message} onChange={(e) => setMessage(e.target.value)} />
        <FilePicker files={files} onChange={setFiles} />
        <button type="submit" disabled={busy || (message.trim() === '' && files.length === 0)} className={outlineButton}>{busy ? 'Posting…' : 'Post update'}</button>
      </form>
    </div>
  );
}
