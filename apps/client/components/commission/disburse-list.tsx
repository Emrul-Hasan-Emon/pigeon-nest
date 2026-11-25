'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { field, money, outlineButton } from '@/components/orders/ui';
import { formatDateTime } from '@/lib/datetime';
import { commissionApi } from '@/lib/api/commission';
import type { CommissionRole, DisburseRow } from '@/types/commission';
import { Lbl, ListFrame, td, th, Th, usePagedList } from './parts';

const EMPTY = { sellerId: '', from: '', to: '', minAmount: '', maxAmount: '' };

/** Payments a seller made to the platform for commission. */
export function DisburseList({ role, sellerId }: { role: CommissionRole; sellerId?: number }) {
  const api = useMemo(() => commissionApi(role), [role]);
  const [f, setF] = useState(EMPTY);
  const list = usePagedList<DisburseRow>(role, api.disbursements, { ...f, sellerId: role === 'admin' ? f.sellerId : '' }, { sellerId });
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF((c) => ({ ...c, [k]: e.target.value }));
  const dirty = Object.values(f).some(Boolean);
  const base = role === 'admin' ? '/admin' : '/seller';
  const showSeller = role === 'admin' && sellerId === undefined;
  return (
    <div>
      <p className="mb-3 text-base text-muted-foreground">
        {role === 'seller' ? 'Money you paid to the platform for system commission.' : 'Money the seller paid to the platform for system commission.'}
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {showSeller && <Lbl text="Seller ID"><input className={`${field} w-full`} inputMode="numeric" placeholder="Seller number" value={f.sellerId} onChange={set('sellerId')} /></Lbl>}
        <Lbl text="Amount from (USD)"><input className={`${field} w-full`} inputMode="decimal" placeholder="Lowest" value={f.minAmount} onChange={set('minAmount')} /></Lbl>
        <Lbl text="Amount up to (USD)"><input className={`${field} w-full`} inputMode="decimal" placeholder="Highest" value={f.maxAmount} onChange={set('maxAmount')} /></Lbl>
        <Lbl text="Date from"><input type="date" className={`${field} w-full`} value={f.from} onChange={set('from')} /></Lbl>
        <Lbl text="Date until"><input type="date" className={`${field} w-full`} value={f.to} onChange={set('to')} /></Lbl>
        {dirty && <button type="button" onClick={() => setF(EMPTY)} className={`${outlineButton} self-end`}>Clear all filters</button>}
      </div>
      <ListFrame {...list}>
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              <Th>Payment no.</Th>
              <Th>Date</Th>
              {showSeller && <Th>Seller</Th>}
              <Th hint="The money paid in this payment">Amount paid (USD)</Th>
              <Th hint="Total system commission at the time of this payment">Total system commission then (USD)</Th>
              <Th hint="System commission still to pay right after this payment">Still to pay after (USD)</Th>
              <Th hint="All system commission paid so far, including this payment">Total paid so far (USD)</Th>
              <Th hint="Receipts or photos attached to this payment">Proof files</Th>
              <th className={th} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && <tr><td colSpan={showSeller ? 9 : 8} className="px-4 py-6 text-center text-muted-foreground">No system commission payments found.</td></tr>}
            {list.rows.map((d) => (
              <tr key={d.id}>
                <td className={`${td} font-medium text-foreground`}>#{d.id}</td>
                <td className={`${td} text-muted-foreground`}>{formatDateTime(d.createdAt)}</td>
                {showSeller && <td className={td}>{d.sellerName}</td>}
                <td className={`${td} font-medium text-foreground`}>{money(d.amount)}</td>
                <td className={`${td} text-muted-foreground`}>{money(d.totalAmount)}</td>
                <td className={`${td} text-muted-foreground`}>{money(d.dueAmount)}</td>
                <td className={`${td} text-muted-foreground`}>{money(d.paidAmount)}</td>
                <td className={`${td} text-muted-foreground`}>{d.attachmentCount > 0 ? d.attachmentCount : '—'}</td>
                <td className={`${td} text-right`}><Link href={`${base}/commission/disbursements/${d.id}`} className="font-semibold text-primary hover:underline">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>
    </div>
  );
}
