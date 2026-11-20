'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { orderApi } from '@/lib/api/orders';
import { formatDateTime } from '@/lib/datetime';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import {
  DELIVERY_TYPES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type GatewayOption,
  type OrderListParams,
  type OrderSummary,
  type StaffRole,
} from '@/types/order';
import {
  base,
  field,
  money,
  ORDER_STATUS_LABEL,
  OrderStatusBadge,
  outlineButton,
  PAYMENT_STATUS_LABEL,
  PaymentStatusBadge,
  primaryButton,
  useApiError,
} from './ui';

const PAGE_SIZE = 20;

interface Filters {
  status: string;
  paymentStatus: string;
  customerSearch: string;
  sellerSearch: string;
  owner: string;
  orderNumber: string;
  gatewayId: string;
  deliveryType: string;
  countryCode: string;
  minTotal: string;
  maxTotal: string;
  createdFrom: string;
  createdTo: string;
}
const EMPTY: Filters = {
  status: '', paymentStatus: '', customerSearch: '', sellerSearch: '', owner: '', orderNumber: '',
  gatewayId: '', deliveryType: '', countryCode: '', minTotal: '', maxTotal: '', createdFrom: '', createdTo: '',
};

export function OrderList({ role }: { role: StaffRole }) {
  const api = useMemo(() => orderApi(role), [role]);
  const errorMessage = useApiError(role);
  const { showToast } = useToast();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const debounced = useDebouncedValue(filters);
  const [rows, setRows] = useState<OrderSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateways, setGateways] = useState<GatewayOption[]>([]);

  useEffect(() => {
    api.options().then((o) => setGateways(o.paymentGateways)).catch(() => undefined);
  }, [api]);

  const params = useCallback(
    (cursor?: number): OrderListParams => {
      const f = debounced;
      return {
        status: (f.status || undefined) as OrderListParams['status'],
        paymentStatus: (f.paymentStatus || undefined) as OrderListParams['paymentStatus'],
        customerSearch: f.customerSearch.trim() || undefined,
        sellerSearch: role === 'admin' ? f.sellerSearch.trim() || undefined : undefined,
        owner: (f.owner || undefined) as OrderListParams['owner'],
        orderNumber: f.orderNumber.trim() || undefined,
        gatewayId: f.gatewayId ? Number(f.gatewayId) : undefined,
        deliveryType: (f.deliveryType || undefined) as OrderListParams['deliveryType'],
        countryCode: f.countryCode.trim().length === 2 ? f.countryCode.trim().toUpperCase() : undefined,
        minTotal: f.minTotal.trim() === '' ? undefined : Number(f.minTotal),
        maxTotal: f.maxTotal.trim() === '' ? undefined : Number(f.maxTotal),
        createdFrom: f.createdFrom || undefined,
        createdTo: f.createdTo || undefined,
        cursor,
        limit: PAGE_SIZE,
      };
    },
    [debounced, role],
  );

  const fetchFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.list(params());
      setRows(r.results);
      setNextCursor(r.nextCursor);
    } catch (e) {
      setRows([]);
      setNextCursor(null);
      setError(errorMessage(e, 'Failed to load orders.'));
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
      const r = await api.list(params(nextCursor));
      setRows((c) => [...c, ...r.results]);
      setNextCursor(r.nextCursor);
    } catch {
      showToast('Failed to load more orders.', 'error');
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {role === 'admin' ? 'Every order from every seller.' : 'Orders placed with your shop.'}
          </p>
        </div>
        <Link href={`${root}/orders/new`} className={primaryButton}>Create order</Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <input className={field} placeholder="Order number" value={filters.orderNumber} onChange={set('orderNumber')} />
        <input className={field} placeholder="Customer name, email or phone" value={filters.customerSearch} onChange={set('customerSearch')} />
        {role === 'admin' && <input className={field} placeholder="Seller name" value={filters.sellerSearch} onChange={set('sellerSearch')} />}
        <select className={field} value={filters.status} onChange={set('status')} aria-label="Order status">
          <option value="">Any order status</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
        </select>
        <select className={field} value={filters.paymentStatus} onChange={set('paymentStatus')} aria-label="Payment status">
          <option value="">Any payment status</option>
          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>)}
        </select>
        <select className={field} value={filters.owner} onChange={set('owner')} aria-label="Customer type">
          <option value="">Accounts and guests</option>
          <option value="customer">Accounts only</option>
          <option value="guest">Guests and walk-ins</option>
        </select>
        <select className={field} value={filters.gatewayId} onChange={set('gatewayId')} aria-label="Payment method">
          <option value="">Any payment method</option>
          {gateways.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className={field} value={filters.deliveryType} onChange={set('deliveryType')} aria-label="Delivery type">
          <option value="">Any delivery type</option>
          {DELIVERY_TYPES.map((d) => <option key={d} value={d} className="capitalize">{d}</option>)}
        </select>
        <input className={field} placeholder="Country code (BD)" maxLength={2} value={filters.countryCode} onChange={set('countryCode')} />
        <input className={field} inputMode="decimal" placeholder="Payable from" value={filters.minTotal} onChange={set('minTotal')} />
        <input className={field} inputMode="decimal" placeholder="Payable up to" value={filters.maxTotal} onChange={set('maxTotal')} />
        <label className="text-xs text-muted-foreground">Placed from<input type="date" className={`${field} mt-0.5 w-full`} value={filters.createdFrom} onChange={set('createdFrom')} /></label>
        <label className="text-xs text-muted-foreground">Placed to<input type="date" className={`${field} mt-0.5 w-full`} value={filters.createdTo} onChange={set('createdTo')} /></label>
        {dirty && (
          <button type="button" onClick={() => setFilters(EMPTY)} className={`${outlineButton} self-end`}>Clear filters</button>
        )}
      </div>

      {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                {['Order', 'Customer', ...(role === 'admin' ? ['Seller'] : []), 'Items', 'Payable', 'Status', 'Payment', 'Placed'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr><td colSpan={role === 'admin' ? 10 : 9} className="px-4 py-6 text-center text-muted-foreground">No orders found.</td></tr>
              )}
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {o.orderNumber}
                    <span className="block text-xs font-normal text-muted-foreground">{o.gateway.name} · {o.deliveryType}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-foreground">{o.customer.name}</span>
                    {o.customer.isGuest && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Guest</span>}
                    <span className="block text-xs text-muted-foreground">{o.customer.phone} · {o.countryName}</span>
                  </td>
                  {role === 'admin' && <td className="px-4 py-3 text-muted-foreground">{o.seller.name}</td>}
                  <td className="px-4 py-3 text-muted-foreground">{o.itemCount}</td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {money(o.payable)}
                    {o.paymentStatus === 'partially_paid' && <span className="block text-xs font-normal text-muted-foreground">{money(o.amountPaid)} paid</span>}
                  </td>
                  <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 py-3"><PaymentStatusBadge status={o.paymentStatus} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(o.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`${root}/orders/${o.id}`} className="text-primary hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && nextCursor !== null && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={loadMore} disabled={loadingMore} className={outlineButton}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
