'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { field, money, outlineButton, PAYMENT_STATUS_LABEL } from '@/components/orders/ui';
import { formatDateTime } from '@/lib/datetime';
import { commissionApi } from '@/lib/api/commission';
import type { CommissionRole, LedgerRow } from '@/types/commission';
import { Lbl, ListFrame, ruleLabel, td, Th, usePagedList } from './parts';

const EMPTY = { sellerId: '', orderNumberId: '', type: '', paymentStatus: '', voided: '', from: '', to: '' };

/** The commission ledger: commission earned per order, and payments made by the seller. */
export function LedgerList({ role, sellerId }: { role: CommissionRole; sellerId?: number }) {
  const api = useMemo(() => commissionApi(role), [role]);
  const [f, setF] = useState(EMPTY);
  const filters = {
    sellerId: role === 'admin' ? f.sellerId : '',
    orderId: f.orderNumberId,
    type: f.type,
    paymentStatus: f.paymentStatus,
    voided: f.voided,
    from: f.from,
    to: f.to,
  };
  const list = usePagedList<LedgerRow>(role, api.ledger, filters, { sellerId });
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((c) => ({ ...c, [k]: e.target.value }));
  const dirty = Object.values(f).some(Boolean);
  const orderBase = role === 'admin' ? '/admin' : '/seller';
  const showSeller = role === 'admin' && sellerId === undefined;

  return (
    <div>
      <p className="mb-3 text-base text-muted-foreground">
        {role === 'seller'
          ? 'Every time system commission was added to what you owe, or you paid it. Read each line as one thing that happened, oldest at the bottom.'
          : 'Every time system commission was added to what the seller owes, or the seller paid it.'}
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {showSeller && <Lbl text="Seller ID"><input className={`${field} w-full`} inputMode="numeric" placeholder="Seller number" value={f.sellerId} onChange={set('sellerId')} /></Lbl>}
        <Lbl text="Order ID"><input className={`${field} w-full`} inputMode="numeric" placeholder="Order number (digits)" value={f.orderNumberId} onChange={set('orderNumberId')} /></Lbl>
        <Lbl text="Kind of record">
          <select className={`${field} w-full`} value={f.type} onChange={set('type')}>
            <option value="">All kinds</option>
            <option value="order_commission">System commission earned on an order</option>
            <option value="commission_payment">Payment to the platform</option>
            <option value="order_return">Taken back because of a return</option>
          </select>
        </Lbl>
        <Lbl text="Order payment">
          <select className={`${field} w-full`} value={f.paymentStatus} onChange={set('paymentStatus')}>
            <option value="">Any</option>
            {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Lbl>
        <Lbl text="Cancelled out (voided)?">
          <select className={`${field} w-full`} value={f.voided} onChange={set('voided')}>
            <option value="">Show all</option>
            <option value="false">Only counted ones</option>
            <option value="true">Only cancelled-out ones</option>
          </select>
        </Lbl>
        <Lbl text="Date from"><input type="date" className={`${field} w-full`} value={f.from} onChange={set('from')} /></Lbl>
        <Lbl text="Date until"><input type="date" className={`${field} w-full`} value={f.to} onChange={set('to')} /></Lbl>
        {dirty && <button type="button" onClick={() => setF(EMPTY)} className={`${outlineButton} self-end`}>Clear all filters</button>}
      </div>
      <ListFrame {...list}>
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              <Th>Date</Th>
              {showSeller && <Th>Seller</Th>}
              <Th hint="What happened on this line">What happened</Th>
              <Th hint="The order, or the payment, this line is about">Order or payment</Th>
              <Th hint="System commission added to what is owed. A minus sign means it was paid or taken back.">System commission (৳)</Th>
              <Th hint="Was the order itself paid when this line was written?">Order paid?</Th>
              <Th hint="System commission still unpaid right after this line">Still to pay after (৳)</Th>
              <Th hint="System commission paid in all, right after this line">Paid so far (৳)</Th>
              <Th hint="Counted lines are part of the balance. Cancelled-out lines were undone, for example when an order was cancelled.">Counts?</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && <tr><td colSpan={showSeller ? 9 : 8} className="px-4 py-6 text-center text-muted-foreground">No system commission records yet. They appear once an order is fully paid.</td></tr>}
            {list.rows.map((r) => (
              <tr key={r.id} className={r.voidedAt ? 'opacity-60' : ''}>
                <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDateTime(r.createdAt)}</td>
                {showSeller && <td className={td}>{r.sellerName}</td>}
                <td className={td}>
                  {r.type === 'order_commission' ? 'System commission earned on the order' : r.type === 'order_return' ? (r.orderItemId ? `Taken back: item #${r.orderItemId} returned` : 'Taken back: whole order returned') : role === 'seller' ? 'You paid the platform' : 'Seller paid the platform'}
                  {r.type === 'order_commission' && r.commissionType && <span className="block text-xs text-muted-foreground">{ruleLabel({ type: r.commissionType, value: r.commissionValue })} of {money(r.orderSubtotal ?? 0)}</span>}
                </td>
                <td className={td}>
                  {r.orderId ? <Link className="text-primary hover:underline" href={`${orderBase}/orders/${r.orderId}`}>{r.orderNumber}</Link>
                    : r.disburseId ? <Link className="text-primary hover:underline" href={`${orderBase}/commission/disbursements/${r.disburseId}`}>Payment #{r.disburseId}</Link> : '—'}
                </td>
                <td className={`${td} font-medium ${r.type === 'commission_payment' ? 'text-emerald-700' : r.type === 'order_return' ? 'text-destructive' : 'text-foreground'}`}>{r.type === 'commission_payment' || r.type === 'order_return' ? '−' : ''}{money(r.totalAmount)}</td>
                <td className={`${td} text-muted-foreground`}>{PAYMENT_STATUS_LABEL[r.paymentStatus as keyof typeof PAYMENT_STATUS_LABEL] ?? r.paymentStatus}</td>
                <td className={`${td} text-muted-foreground`}>{money(r.dueAfter)}</td>
                <td className={`${td} text-muted-foreground`}>{money(r.paidAfter)}</td>
                <td className={td}>
                  {r.voidedAt ? <span title={r.voidReason ?? ''} className="whitespace-nowrap rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">Cancelled out</span> : <span className="whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Counted</span>}
                  {r.voidReason && <span className="block text-xs text-muted-foreground">{r.voidReason}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>
    </div>
  );
}
