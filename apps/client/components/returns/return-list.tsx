'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { field, money, outlineButton, useApiError } from '@/components/orders/ui';
import { listAdminReturns, listSellerReturns } from '@/lib/api/returns';
import { formatDateTime } from '@/lib/datetime';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { RETURN_STATUSES, type ReturnPage, type ReturnScope, type ReturnStatus } from '@/types/returns';
import { OrderLink, ReturnBadge, RETURN_LABEL, SCOPE_LABEL } from './parts';
import { LoadingBlock } from '@/components/ui/skeleton';

const PAGE_SIZE = 20;
const EMPTY = { status: '', scope: '', search: '', sellerId: '', orderId: '' };

/** Returns for the seller (their own) or the admin (everyone's). */
export function ReturnList({ role }: { role: 'admin' | 'seller' }) {
  const errorMessage = useApiError(role);
  const [f, setF] = useState(EMPTY);
  const debounced = useDebouncedValue(f);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReturnPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = `/${role}`;

  const load = useCallback(() => {
    const params = {
      page,
      pageSize: PAGE_SIZE,
      status: (debounced.status || undefined) as ReturnStatus | undefined,
      scope: (debounced.scope || undefined) as ReturnScope | undefined,
      search: debounced.search.trim() || undefined,
      sellerId: role === 'admin' && debounced.sellerId.trim() ? Number(debounced.sellerId) : undefined,
      orderId: debounced.orderId.trim() ? Number(debounced.orderId) : undefined,
    };
    (role === 'admin' ? listAdminReturns : listSellerReturns)(params)
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e, 'Failed to load returns.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debounced, role]);
  useEffect(() => {
    load();
  }, [load]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((c) => ({ ...c, [k]: e.target.value }));
    setPage(1);
  };
  const dirty = Object.values(f).some(Boolean);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <input className={field} placeholder="Return or order number" aria-label="Search" value={f.search} onChange={set('search')} />
        <select className={field} aria-label="Status" value={f.status} onChange={set('status')}>
          <option value="">Any status</option>
          {RETURN_STATUSES.map((s) => <option key={s} value={s}>{RETURN_LABEL[s]}</option>)}
        </select>
        <select className={field} aria-label="Kind" value={f.scope} onChange={set('scope')}>
          <option value="">Whole order or items</option>
          <option value="full_order">Whole order</option>
          <option value="items">Items</option>
        </select>
        {role === 'admin' && <input className={field} inputMode="numeric" placeholder="Seller ID" value={f.sellerId} onChange={set('sellerId')} />}
        {role === 'admin' && <input className={field} inputMode="numeric" placeholder="Order ID" value={f.orderId} onChange={set('orderId')} />}
        {dirty && <button type="button" className={`${outlineButton} self-end`} onClick={() => { setF(EMPTY); setPage(1); }}>Clear filters</button>}
      </div>

      {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {data === null && !error ? (
        <LoadingBlock />
      ) : data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  {['Return', 'Order', ...(role === 'admin' ? ['Seller'] : []), 'Kind', 'Refund', 'Commission back', 'Status', 'Requested'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.results.length === 0 && <tr><td colSpan={role === 'admin' ? 9 : 8} className="px-4 py-6 text-center text-muted-foreground">No returns found.</td></tr>}
                {data.results.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {r.returnNumber}
                      <span className="block text-xs font-normal text-muted-foreground">{r.previewItems.map((p) => p.productName).join(', ')}{r.itemCount > 3 ? '…' : ''}</span>
                    </td>
                    <td className="px-4 py-3"><OrderLink role={role} order={r.order} /></td>
                    {role === 'admin' && <td className="px-4 py-3 text-muted-foreground">{r.seller.name}</td>}
                    <td className="px-4 py-3 text-muted-foreground">{SCOPE_LABEL[r.scope]} · {r.itemCount}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{money(r.refundAmount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{money(r.commissionAmount ?? 0)}</td>
                    <td className="px-4 py-3"><ReturnBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(r.createdAt)}<span className="block text-xs">by {r.requestedBy.type === 'user' ? 'customer' : r.requestedBy.type}</span></td>
                    <td className="px-4 py-3 text-right"><Link href={`${root}/returns/${r.id}`} className="text-primary hover:underline">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm text-muted-foreground">
              <button type="button" className={outlineButton} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span>Page {data.page} of {data.totalPages} · {data.total} returns</span>
              <button type="button" className={outlineButton} disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
