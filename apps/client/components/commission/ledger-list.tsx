'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { field, money, outlineButton, PAYMENT_STATUS_LABEL } from '@/components/orders/ui';
import { formatDateTime } from '@/lib/datetime';
import { commissionApi } from '@/lib/api/commission';
import type { CommissionRole, LedgerRow } from '@/types/commission';
import { ListFrame, ruleLabel, td, th, usePagedList } from './parts';

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
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {showSeller && <input className={field} inputMode="numeric" placeholder="Seller ID" value={f.sellerId} onChange={set('sellerId')} />}
        <input className={field} inputMode="numeric" placeholder="Order ID" value={f.orderNumberId} onChange={set('orderNumberId')} />
        <select className={field} value={f.type} onChange={set('type')} aria-label="Type">
          <option value="">Any type</option>
          <option value="order_commission">Commission from an order</option>
          <option value="commission_payment">Payment to the platform</option>
          <option value="order_return">Taken back on a return</option>
        </select>
        <select className={field} value={f.paymentStatus} onChange={set('paymentStatus')} aria-label="Payment status">
          <option value="">Any payment status</option>
          {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={field} value={f.voided} onChange={set('voided')} aria-label="Voided">
          <option value="">Voided or not</option>
          <option value="false">Not voided</option>
          <option value="true">Voided only</option>
        </select>
        <label className="text-xs text-muted-foreground">From<input type="date" className={`${field} mt-0.5 w-full`} value={f.from} onChange={set('from')} /></label>
        <label className="text-xs text-muted-foreground">To<input type="date" className={`${field} mt-0.5 w-full`} value={f.to} onChange={set('to')} /></label>
        {dirty && <button type="button" onClick={() => setF(EMPTY)} className={`${outlineButton} self-end`}>Clear filters</button>}
      </div>
      <ListFrame {...list}>
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              <th className={th}>When</th>
              {showSeller && <th className={th}>Seller</th>}
              <th className={th}>What</th>
              <th className={th}>Order</th>
              <th className={th}>Amount</th>
              <th className={th}>Payment status</th>
              <th className={th}>Due after</th>
              <th className={th}>Paid after</th>
              <th className={th}>State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && <tr><td colSpan={showSeller ? 9 : 8} className="px-4 py-6 text-center text-muted-foreground">No commission records found.</td></tr>}
            {list.rows.map((r) => (
              <tr key={r.id} className={r.voidedAt ? 'opacity-60' : ''}>
                <td className={`${td} text-muted-foreground`}>{formatDateTime(r.createdAt)}</td>
                {showSeller && <td className={td}>{r.sellerName}</td>}
                <td className={td}>
                  {r.type === 'order_commission' ? 'Commission earned' : r.type === 'order_return' ? (r.orderItemId ? `Taken back: item #${r.orderItemId} returned` : 'Taken back: whole order returned') : 'Paid to the platform'}
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
                  {r.voidedAt ? <span title={r.voidReason ?? ''} className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">Voided</span> : <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Counted</span>}
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
