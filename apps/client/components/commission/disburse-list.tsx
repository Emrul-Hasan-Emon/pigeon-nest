'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { field, money, outlineButton } from '@/components/orders/ui';
import { formatDateTime } from '@/lib/datetime';
import { commissionApi } from '@/lib/api/commission';
import type { CommissionRole, DisburseRow } from '@/types/commission';
import { ListFrame, td, th, usePagedList } from './parts';

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
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {showSeller && <input className={field} inputMode="numeric" placeholder="Seller ID" value={f.sellerId} onChange={set('sellerId')} />}
        <input className={field} inputMode="decimal" placeholder="Amount from" value={f.minAmount} onChange={set('minAmount')} />
        <input className={field} inputMode="decimal" placeholder="Amount up to" value={f.maxAmount} onChange={set('maxAmount')} />
        <label className="text-xs text-muted-foreground">From<input type="date" className={`${field} mt-0.5 w-full`} value={f.from} onChange={set('from')} /></label>
        <label className="text-xs text-muted-foreground">To<input type="date" className={`${field} mt-0.5 w-full`} value={f.to} onChange={set('to')} /></label>
        {dirty && <button type="button" onClick={() => setF(EMPTY)} className={`${outlineButton} self-end`}>Clear filters</button>}
      </div>
      <ListFrame {...list}>
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              <th className={th}>Payment</th>
              <th className={th}>Date</th>
              {showSeller && <th className={th}>Seller</th>}
              <th className={th}>Amount</th>
              <th className={th}>Total commission then</th>
              <th className={th}>Due after</th>
              <th className={th}>Paid in total</th>
              <th className={th}>Files</th>
              <th className={`${th} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && <tr><td colSpan={showSeller ? 9 : 8} className="px-4 py-6 text-center text-muted-foreground">No commission payments found.</td></tr>}
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
                <td className={`${td} text-right`}><Link href={`${base}/commission/disbursements/${d.id}`} className="text-primary hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>
    </div>
  );
}
