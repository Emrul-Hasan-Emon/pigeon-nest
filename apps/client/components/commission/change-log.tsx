'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { field, money, outlineButton } from '@/components/orders/ui';
import { commissionApi } from '@/lib/api/commission';
import { formatDateTime } from '@/lib/datetime';
import type { CommissionRole } from '@/types/commission';
import type { CommissionChangeRow } from '@/types/returns';
import { Lbl, ListFrame, td, Th, usePagedList } from './parts';

export const CHANGE_LABEL: Record<string, string> = {
  for_system: 'Earned from an order',
  order_returned_to_customer: 'Taken back: returned to the customer',
  commission_payment: 'Paid to the platform',
  commission_voided: 'Cancelled out (order cancelled or payment reversed)',
  return_undone: 'Return undone: earned again',
};

const EMPTY = { sellerId: '', status: '', from: '', to: '' };

/** A signed change, or a dash when the number did not move. */
function Delta({ from, to }: { from: number; to: number }) {
  const d = Math.round((to - from) * 100) / 100;
  if (d === 0) return <span className="text-muted-foreground">{money(to)}</span>;
  return (
    <span>
      <span className="text-muted-foreground">{money(from)} → </span>
      <strong className={d < 0 ? 'text-destructive' : 'text-emerald-700'}>{money(to)}</strong>
      <span className={`ml-1 text-xs ${d < 0 ? 'text-destructive' : 'text-emerald-700'}`}>({d > 0 ? '+' : ''}{money(d)})</span>
    </span>
  );
}

/** Before and after of every change to a commission balance. */
export function ChangeLog({ role, sellerId }: { role: CommissionRole; sellerId?: number }) {
  const api = useMemo(() => commissionApi(role), [role]);
  const [f, setF] = useState(EMPTY);
  const filters = { sellerId: role === 'admin' ? f.sellerId : '', status: f.status, from: f.from, to: f.to };
  const list = usePagedList<CommissionChangeRow>(role, api.changes, filters, { sellerId });
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((c) => ({ ...c, [k]: e.target.value }));
  const dirty = Object.values(f).some(Boolean);
  const showSeller = role === 'admin' && sellerId === undefined;
  const root = `/${role}`;

  return (
    <div>
      <p className="mb-3 text-base text-muted-foreground">
        Every time the three numbers (total system commission, still to pay, already paid) moved, with the number before and after.
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {showSeller && <Lbl text="Seller ID"><input className={`${field} w-full`} inputMode="numeric" placeholder="Seller number" value={f.sellerId} onChange={set('sellerId')} /></Lbl>}
        <Lbl text="What happened">
          <select className={`${field} w-full`} value={f.status} onChange={set('status')}>
            <option value="">Anything</option>
            {Object.entries(CHANGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
              <Th hint="Why the numbers moved">What happened</Th>
              <Th hint="All system commission on fully paid orders, before → after (USD)">Total system commission (USD)</Th>
              <Th hint="System commission not paid yet, before → after (USD)">Still to pay (USD)</Th>
              <Th hint="System commission already paid, before → after (USD)">Already paid (USD)</Th>
              <Th hint="Who caused the change">Done by</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && <tr><td colSpan={showSeller ? 7 : 6} className="px-4 py-6 text-center text-muted-foreground">No balance changes yet.</td></tr>}
            {list.rows.map((r) => (
              <tr key={r.id}>
                <td className={`${td} text-muted-foreground`}>{formatDateTime(r.createdAt)}</td>
                {showSeller && <td className={td}>{r.sellerName}</td>}
                <td className={td}>
                  {CHANGE_LABEL[r.commissionStatus] ?? r.commissionStatus}
                  <span className="block text-xs text-muted-foreground">
                    {r.orderId && <Link className="text-primary hover:underline" href={`${root}/orders/${r.orderId}`}>Order #{r.orderId}</Link>}
                    {r.orderItemId ? ` · item #${r.orderItemId}` : ''}
                    {r.orderReturnId && <> · <Link className="text-primary hover:underline" href={`${root}/returns/${r.orderReturnId}`}>Return #{r.orderReturnId}</Link></>}
                  </span>
                  {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
                </td>
                <td className={td}><Delta from={r.currentTotalCommission} to={r.newTotalCommission} /></td>
                <td className={td}><Delta from={r.currentDueCommission} to={r.newDueCommission} /></td>
                <td className={td}><Delta from={r.currentPaidCommission} to={r.newPaidCommission} /></td>
                <td className={`${td} text-muted-foreground`}>{r.creatorName ?? '—'}{r.creatorType ? ` (${r.creatorType === 'user' ? 'customer' : r.creatorType})` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>
    </div>
  );
}
