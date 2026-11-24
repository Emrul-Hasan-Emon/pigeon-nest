'use client';

import { useState } from 'react';
import Link from 'next/link';
import { field, money, outlineButton } from '@/components/orders/ui';
import { formatDateTime } from '@/lib/datetime';
import { adminCommission } from '@/lib/api/commission';
import type { BalanceRow } from '@/types/commission';
import { ListFrame, td, th, usePagedList } from './parts';

const EMPTY = { search: '', status: '' };

/** Admin: what every seller has earned the platform, what is still due, and what was paid. */
export function BalanceList() {
  const [f, setF] = useState(EMPTY);
  const list = usePagedList<BalanceRow>('admin', adminCommission.balances, f);
  const dirty = Object.values(f).some(Boolean);
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">System commission balances</h1>
        <p className="text-sm text-muted-foreground">System commission is earned when an order is fully paid. Open a seller to record a payment they made.</p>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <input className={field} placeholder="Seller name, email or phone" value={f.search} onChange={(e) => setF((c) => ({ ...c, search: e.target.value }))} />
        <select className={field} value={f.status} onChange={(e) => setF((c) => ({ ...c, status: e.target.value }))} aria-label="Status">
          <option value="">Any status</option>
          <option value="due">System commission due</option>
          <option value="cleared">Nothing due</option>
        </select>
        {dirty && <button type="button" onClick={() => setF(EMPTY)} className={outlineButton}>Clear filters</button>}
      </div>
      <ListFrame {...list}>
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              <th className={th}>Seller</th>
              <th className={th}>Total system commission</th>
              <th className={th}>Due</th>
              <th className={th}>Paid</th>
              <th className={th}>Updated</th>
              <th className={`${th} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No system commission yet. It starts once an order is fully paid.</td></tr>}
            {list.rows.map((b) => (
              <tr key={b.id}>
                <td className={td}><span className="font-medium text-foreground">{b.sellerName}</span><span className="block text-xs text-muted-foreground">{b.sellerPhone}</span></td>
                <td className={`${td} text-foreground`}>{money(b.totalCommission)}</td>
                <td className={`${td} font-medium ${b.dueCommission > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>{money(b.dueCommission)}</td>
                <td className={`${td} text-emerald-700`}>{money(b.paidCommission)}</td>
                <td className={`${td} text-muted-foreground`}>{formatDateTime(b.updatedAt)}</td>
                <td className={`${td} text-right`}><Link href={`/admin/commission/${b.sellerId}`} className="text-primary hover:underline">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>
    </div>
  );
}
