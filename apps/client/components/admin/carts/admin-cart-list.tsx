'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { listAdminCarts } from '@/lib/api/cart';
import { formatDateTime } from '@/lib/datetime';
import type { AdminCartListParams, AdminCartRow } from '@/types/cart';
import { LoadingBlock } from '@/components/ui/skeleton';

const PAGE_SIZE = 20;
const field =
  'rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

interface Filters {
  customerSearch: string;
  sellerSearch: string;
  owner: string;
  orderNumber: string;
  hasItems: string;
  minTotal: string;
  maxTotal: string;
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
}
const EMPTY: Filters = {
  customerSearch: '', sellerSearch: '', owner: '', orderNumber: '', hasItems: '',
  minTotal: '', maxTotal: '', createdFrom: '', createdTo: '', updatedFrom: '', updatedTo: '',
};

export function AdminCartList({ state }: { state: 'active' | 'inactive' }) {
  const { showToast } = useToast();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const debounced = useDebouncedValue(filters);
  const [rows, setRows] = useState<AdminCartRow[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInactive = state === 'inactive';

  const params = useCallback(
    (cursor?: number): AdminCartListParams => {
      const f = debounced;
      return {
        state,
        customerSearch: f.customerSearch.trim() || undefined,
        sellerSearch: f.sellerSearch.trim() || undefined,
        owner: (f.owner || undefined) as AdminCartListParams['owner'],
        orderNumber: isInactive ? f.orderNumber.trim() || undefined : undefined,
        hasItems: f.hasItems === '' ? undefined : f.hasItems === 'true',
        minTotal: f.minTotal.trim() === '' ? undefined : Number(f.minTotal),
        maxTotal: f.maxTotal.trim() === '' ? undefined : Number(f.maxTotal),
        createdFrom: f.createdFrom || undefined,
        createdTo: f.createdTo || undefined,
        updatedFrom: f.updatedFrom || undefined,
        updatedTo: f.updatedTo || undefined,
        cursor,
        limit: PAGE_SIZE,
      };
    },
    [debounced, state, isInactive],
  );

  const fetchFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listAdminCarts(params());
      setRows(r.results);
      setNextCursor(r.nextCursor);
    } catch (e) {
      setRows([]);
      setNextCursor(null);
      setError(e instanceof Error ? e.message : 'Failed to load carts.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFirst();
  }, [fetchFirst]);

  async function loadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const r = await listAdminCarts(params(nextCursor));
      setRows((c) => [...c, ...r.results]);
      setNextCursor(r.nextCursor);
    } catch {
      showToast('Failed to load more carts.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  const dirty = Object.values(filters).some(Boolean);

  const columns = ['Cart', 'Customer', 'Seller', 'Items', 'List total', 'Payable', ...(isInactive ? ['Order'] : []), 'Updated'];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{isInactive ? 'Inactive carts' : 'Active carts'}</h1>
        <p className="text-sm text-muted-foreground">
          {isInactive ? 'Carts that were checked out into an order. They are kept as a record.' : 'Carts customers and guests are still filling, one per seller.'}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <input className={field} placeholder="Customer name, email or phone" value={filters.customerSearch} onChange={set('customerSearch')} />
        <input className={field} placeholder="Seller name" value={filters.sellerSearch} onChange={set('sellerSearch')} />
        <select className={field} value={filters.owner} onChange={set('owner')} aria-label="Owner">
          <option value="">Customers and guests</option>
          <option value="customer">Customers only</option>
          <option value="guest">Guests only</option>
        </select>
        {isInactive ? (
          <input className={field} placeholder="Order number" value={filters.orderNumber} onChange={set('orderNumber')} />
        ) : (
          <select className={field} value={filters.hasItems} onChange={set('hasItems')} aria-label="Items">
            <option value="">With or without items</option>
            <option value="true">Has items</option>
            <option value="false">Empty</option>
          </select>
        )}
        <input className={field} inputMode="decimal" placeholder="Payable from" value={filters.minTotal} onChange={set('minTotal')} />
        <input className={field} inputMode="decimal" placeholder="Payable up to" value={filters.maxTotal} onChange={set('maxTotal')} />
        <label className="text-xs text-muted-foreground">Created from<input type="date" className={`${field} mt-0.5 w-full`} value={filters.createdFrom} onChange={set('createdFrom')} /></label>
        <label className="text-xs text-muted-foreground">Created to<input type="date" className={`${field} mt-0.5 w-full`} value={filters.createdTo} onChange={set('createdTo')} /></label>
        <label className="text-xs text-muted-foreground">Updated from<input type="date" className={`${field} mt-0.5 w-full`} value={filters.updatedFrom} onChange={set('updatedFrom')} /></label>
        <label className="text-xs text-muted-foreground">Updated to<input type="date" className={`${field} mt-0.5 w-full`} value={filters.updatedTo} onChange={set('updatedTo')} /></label>
        {dirty && (
          <button type="button" onClick={() => setFilters(EMPTY)} className="self-end rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
            Clear filters
          </button>
        )}
      </div>

      {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                {columns.map((h) => <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>)}
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr><td colSpan={columns.length + 1} className="px-4 py-6 text-center text-muted-foreground">No carts found.</td></tr>
              )}
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-foreground">#{c.id}</td>
                  <td className="px-4 py-3">
                    {c.owner.user ? (
                      <>
                        <span className="text-foreground">{c.owner.user.name}</span>
                        <span className="block text-xs text-muted-foreground">{c.owner.user.phone}</span>
                      </>
                    ) : (
                      <>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Guest</span>
                        <span className="ml-2 text-xs text-muted-foreground">{c.owner.sessionId}</span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.seller.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.itemCount} <span className="text-xs">({c.lineCount} {c.lineCount === 1 ? 'line' : 'lines'})</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{c.listTotal}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{c.payableTotal}</td>
                  {isInactive && (
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.order ? <>{c.order.orderNumber ?? `#${c.order.id}`}{c.order.status && <span className="ml-1 text-xs capitalize">({c.order.status})</span>}</> : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(c.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/carts/${c.id}`} className="text-primary hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && nextCursor !== null && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
