'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { orderApi } from '@/lib/api/orders';
import { formatDateTime } from '@/lib/datetime';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { PAYMENT_STATUSES, type GatewayOption, type PaymentListParams, type PaymentRow, type StaffRole } from '@/types/order';
import { base, field, money, outlineButton, PAYMENT_STATUS_LABEL, PaymentStatusBadge, useApiError } from './ui';

const PAGE_SIZE = 20;

interface Filters {
  status: string;
  orderNumber: string;
  customerSearch: string;
  transactionId: string;
  gatewayId: string;
  hasAttachments: string;
  reversed: string;
  minAmount: string;
  maxAmount: string;
  createdFrom: string;
  createdTo: string;
  paidFrom: string;
  paidTo: string;
}
const EMPTY: Filters = {
  status: '', orderNumber: '', customerSearch: '', transactionId: '', gatewayId: '', hasAttachments: '', reversed: '',
  minAmount: '', maxAmount: '', createdFrom: '', createdTo: '', paidFrom: '', paidTo: '',
};

export function PaymentList({ role }: { role: StaffRole }) {
  const api = useMemo(() => orderApi(role), [role]);
  const errorMessage = useApiError(role);
  const { showToast } = useToast();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const debounced = useDebouncedValue(filters);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateways, setGateways] = useState<GatewayOption[]>([]);

  useEffect(() => {
    api.options().then((o) => setGateways(o.paymentGateways)).catch(() => undefined);
  }, [api]);

  const params = useCallback(
    (cursor?: number): PaymentListParams => {
      const f = debounced;
      return {
        status: (f.status || undefined) as PaymentListParams['status'],
        orderNumber: f.orderNumber.trim() || undefined,
        customerSearch: f.customerSearch.trim() || undefined,
        transactionId: f.transactionId.trim() || undefined,
        gatewayId: f.gatewayId ? Number(f.gatewayId) : undefined,
        hasAttachments: f.hasAttachments === '' ? undefined : f.hasAttachments === 'true',
        reversed: f.reversed === '' ? undefined : f.reversed === 'true',
        minAmount: f.minAmount.trim() === '' ? undefined : Number(f.minAmount),
        maxAmount: f.maxAmount.trim() === '' ? undefined : Number(f.maxAmount),
        createdFrom: f.createdFrom || undefined,
        createdTo: f.createdTo || undefined,
        paidFrom: f.paidFrom || undefined,
        paidTo: f.paidTo || undefined,
        cursor,
        limit: PAGE_SIZE,
      };
    },
    [debounced],
  );

  const fetchFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listPayments(params());
      setRows(r.results);
      setNextCursor(r.nextCursor);
    } catch (e) {
      setRows([]);
      setNextCursor(null);
      setError(errorMessage(e, 'Failed to load payments.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, params]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFirst();
  }, [fetchFirst]);

  async function loadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const r = await api.listPayments(params(nextCursor));
      setRows((c) => [...c, ...r.results]);
      setNextCursor(r.nextCursor);
    } catch {
      showToast('Failed to load more payments.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  const dirty = Object.values(filters).some(Boolean);
  const root = base(role);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground">
          {role === 'admin' ? 'Every payment on every order.' : 'Payments on your orders.'} Mark an order paid from its details page.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <input className={field} placeholder="Order number" value={filters.orderNumber} onChange={set('orderNumber')} />
        <input className={field} placeholder="Customer name, email or phone" value={filters.customerSearch} onChange={set('customerSearch')} />
        <input className={field} placeholder="Transaction ID" value={filters.transactionId} onChange={set('transactionId')} />
        <select className={field} value={filters.status} onChange={set('status')} aria-label="Payment status">
          <option value="">Any payment status</option>
          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>)}
        </select>
        <select className={field} value={filters.gatewayId} onChange={set('gatewayId')} aria-label="Payment method">
          <option value="">Any payment method</option>
          {gateways.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className={field} value={filters.hasAttachments} onChange={set('hasAttachments')} aria-label="Proof files">
          <option value="">With or without proof files</option>
          <option value="true">Has proof files</option>
          <option value="false">No proof files</option>
        </select>
        <select className={field} value={filters.reversed} onChange={set('reversed')} aria-label="Reversed">
          <option value="">Reversed or not</option>
          <option value="true">Reversed only</option>
          <option value="false">Not reversed</option>
        </select>
        <input className={field} inputMode="decimal" placeholder="Amount from" value={filters.minAmount} onChange={set('minAmount')} />
        <input className={field} inputMode="decimal" placeholder="Amount up to" value={filters.maxAmount} onChange={set('maxAmount')} />
        <label className="text-xs text-muted-foreground">Created from<input type="date" className={`${field} mt-0.5 w-full`} value={filters.createdFrom} onChange={set('createdFrom')} /></label>
        <label className="text-xs text-muted-foreground">Created to<input type="date" className={`${field} mt-0.5 w-full`} value={filters.createdTo} onChange={set('createdTo')} /></label>
        <label className="text-xs text-muted-foreground">Paid from<input type="date" className={`${field} mt-0.5 w-full`} value={filters.paidFrom} onChange={set('paidFrom')} /></label>
        <label className="text-xs text-muted-foreground">Paid to<input type="date" className={`${field} mt-0.5 w-full`} value={filters.paidTo} onChange={set('paidTo')} /></label>
        {dirty && <button type="button" onClick={() => setFilters(EMPTY)} className={`${outlineButton} self-end`}>Clear filters</button>}
      </div>

      {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                {['Payment', 'Order', 'Customer', ...(role === 'admin' ? ['Seller'] : []), 'Method', 'Amount', 'Status', 'Proof', 'Paid'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && <tr><td colSpan={role === 'admin' ? 11 : 10} className="px-4 py-6 text-center text-muted-foreground">No payments found.</td></tr>}
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium text-foreground">#{p.id}</td>
                  <td className="px-4 py-3"><Link className="text-primary hover:underline" href={`${root}/orders/${p.orderId}`}>{p.orderNumber}</Link></td>
                  <td className="px-4 py-3 text-muted-foreground">{p.customer?.name}<span className="block text-xs">{p.customer?.phone}</span></td>
                  {role === 'admin' && <td className="px-4 py-3 text-muted-foreground">{p.seller?.name}</td>}
                  <td className="px-4 py-3 text-muted-foreground">{p.gateway.name}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{money(p.amount)}</td>
                  <td className="px-4 py-3">{p.reversal ? <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">Reversed</span> : <PaymentStatusBadge status={p.status} />}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.attachmentCount > 0 ? `${p.attachmentCount} ${p.attachmentCount === 1 ? 'file' : 'files'}` : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.paidAt ? formatDateTime(p.paidAt) : 'Not yet'}</td>
                  <td className="px-4 py-3 text-right"><Link href={`${root}/payments/${p.id}`} className="text-primary hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && nextCursor !== null && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={loadMore} disabled={loadingMore} className={outlineButton}>{loadingMore ? 'Loading…' : 'Load more'}</button>
        </div>
      )}
    </div>
  );
}
