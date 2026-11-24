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
  SELLER_NEXT,
  type GatewayOption,
  type OrderListParams,
  type OrderStatus,
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
import { LoadingBlock } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FilterField, FilterPanel } from '@/components/ui/filter-panel';

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

  // Bulk update: tick orders that are all in the same status, then move them together. A seller follows the usual
  // steps; an admin may move them to any other status.
  const bulk = true;
  const [picked, setPicked] = useState<number[]>([]);
  const [moveTo, setMoveTo] = useState<OrderStatus | ''>('');
  const [note, setNote] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const pickedStatus = rows.find((r) => r.id === picked[0])?.status ?? null;
  const stepsFrom = (status: OrderStatus): OrderStatus[] => (role === 'admin' ? ORDER_STATUSES.filter((s) => s !== status) : SELLER_NEXT[status] ?? []);
  const canMove = (o: OrderSummary) => stepsFrom(o.status).length > 0;
  const nextSteps = pickedStatus ? stepsFrom(pickedStatus) : [];
  // The status a header tick selects: the one already picked, else the filter, else the first order that can move.
  const headerStatus = pickedStatus ?? ((filters.status as OrderStatus) || rows.find(canMove)?.status) ?? null;
  const selectable = (o: OrderSummary) => canMove(o) && (pickedStatus === null || o.status === pickedStatus);
  const headerRows = headerStatus ? rows.filter((r) => r.status === headerStatus && canMove(r)) : [];
  const allHeaderPicked = headerRows.length > 0 && headerRows.every((r) => picked.includes(r.id));

  function toggle(id: number) {
    setPicked((p) => {
      const next = p.includes(id) ? p.filter((x) => x !== id) : [...p, id];
      if (next.length === 0 || next.length === 1) setMoveTo('');
      return next;
    });
  }

  async function runBulk() {
    if (!moveTo || picked.length === 0) return;
    setBulkBusy(true);
    try {
      const r = await api.bulkStatus(picked, moveTo, note.trim() || undefined);
      const bad = r.results.filter((x) => !x.ok);
      showToast(
        bad.length === 0
          ? `${r.updated} ${r.updated === 1 ? 'order' : 'orders'} updated.`
          : `${r.updated} updated, ${bad.length} failed: ${bad.map((x) => `${x.orderNumber} (${x.error})`).join('; ')}`,
        bad.length === 0 ? 'success' : 'error',
      );
      setPicked([]);
      setMoveTo('');
      setNote('');
      fetchFirst();
    } catch (e) {
      showToast(errorMessage(e, 'Could not update the orders.'), 'error');
    } finally {
      setBulkBusy(false);
      setConfirmCancel(false);
    }
  }

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

      <FilterPanel
        activeCount={Object.values(filters).filter(Boolean).length}
        onClear={() => setFilters(EMPTY)}
        moreActive={Boolean(filters.gatewayId || filters.deliveryType || filters.countryCode || filters.minTotal || filters.maxTotal || filters.createdFrom || filters.createdTo)}
        more={
          <>
            <FilterField label="Payment method">
              <select className={`${field} w-full`} value={filters.gatewayId} onChange={set('gatewayId')}>
                <option value="">Any payment method</option>
                {gateways.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </FilterField>
            <FilterField label="Delivery type">
              <select className={`${field} w-full`} value={filters.deliveryType} onChange={set('deliveryType')}>
                <option value="">Any delivery type</option>
                {DELIVERY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </FilterField>
            <FilterField label="Country code">
              <input className={`${field} w-full`} placeholder="BD" maxLength={2} value={filters.countryCode} onChange={set('countryCode')} />
            </FilterField>
            <span className="hidden md:block" />
            <FilterField label="Payable from">
              <input className={`${field} w-full`} inputMode="decimal" placeholder="0" value={filters.minTotal} onChange={set('minTotal')} />
            </FilterField>
            <FilterField label="Payable up to">
              <input className={`${field} w-full`} inputMode="decimal" placeholder="No limit" value={filters.maxTotal} onChange={set('maxTotal')} />
            </FilterField>
            <FilterField label="Placed from">
              <input type="date" className={`${field} w-full`} value={filters.createdFrom} onChange={set('createdFrom')} />
            </FilterField>
            <FilterField label="Placed to">
              <input type="date" className={`${field} w-full`} value={filters.createdTo} onChange={set('createdTo')} />
            </FilterField>
          </>
        }
      >
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
      </FilterPanel>

      {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {bulk && !loading && rows.some(canMove) && picked.length === 0 && (
        <p className="mb-2 text-sm text-muted-foreground">Tick the orders you want to move together. They must all be waiting for the same step.</p>
      )}

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                {bulk && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={headerStatus ? `Select every ${ORDER_STATUS_LABEL[headerStatus].toLowerCase()} order on this page` : 'Select orders'}
                      title={headerStatus ? `Select every ${ORDER_STATUS_LABEL[headerStatus].toLowerCase()} order on this page` : undefined}
                      disabled={headerRows.length === 0}
                      checked={allHeaderPicked}
                      onChange={() => setPicked(allHeaderPicked ? [] : headerRows.map((r) => r.id))}
                    />
                  </th>
                )}
                {['Order', 'Customer', ...(role === 'admin' ? ['Seller'] : []), 'Items', 'Payable', 'Status', 'Payment', 'Placed'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr><td colSpan={role === 'admin' ? 10 : bulk ? 10 : 9} className="px-4 py-6 text-center text-muted-foreground">No orders found.</td></tr>
              )}
              {rows.map((o) => (
                <tr key={o.id} className={picked.includes(o.id) ? 'bg-accent/40' : undefined}>
                  {bulk && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select order ${o.orderNumber}`}
                        title={!canMove(o) ? 'Nothing more to do on this order' : !selectable(o) ? 'This order is at a different step' : undefined}
                        disabled={!selectable(o)}
                        checked={picked.includes(o.id)}
                        onChange={() => toggle(o.id)}
                      />
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                    {o.orderNumber}
                    <span className="block text-xs font-normal text-muted-foreground">{o.gateway.name} · {o.deliveryType}</span>
                  </td>
                  <td className="px-4 py-3">
                    {role === 'admin' && o.customer.userId
                      ? <Link href={`/admin/users/${o.customer.userId}`} className="font-medium text-primary underline underline-offset-2 hover:opacity-70">{o.customer.name}</Link>
                      : <span className="text-foreground">{o.customer.name}</span>}
                    {o.customer.isGuest && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Guest</span>}
                    <span className="block text-xs text-muted-foreground">{o.customer.phone} · {o.countryName}</span>
                  </td>
                  {role === 'admin' && <td className="px-4 py-3"><Link href={`/admin/sellers/${o.seller.id}`} className="font-medium text-primary underline underline-offset-2 hover:opacity-70">{o.seller.name}</Link></td>}
                  <td className="px-4 py-3 text-muted-foreground">{o.itemCount}</td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {money(o.payable)}
                    {o.paymentStatus === 'partially_paid' && <span className="block text-xs font-normal text-muted-foreground">{money(o.amountPaid)} paid</span>}
                  </td>
                  <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 py-3"><PaymentStatusBadge status={o.paymentStatus} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(o.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`${root}/orders/${o.id}`} className="text-primary hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bulk && picked.length > 0 && pickedStatus && (
        <div className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
          <p className="mr-auto text-base font-medium text-foreground">
            {picked.length} {picked.length === 1 ? 'order' : 'orders'} selected
            <span className="block text-sm font-normal text-muted-foreground">All {ORDER_STATUS_LABEL[pickedStatus].toLowerCase()}</span>
          </p>
          <label className="text-sm font-medium text-foreground">
            Move to
            <select className={`${field} mt-1 block`} value={moveTo} onChange={(e) => setMoveTo(e.target.value as OrderStatus)}>
              <option value="">Choose a step</option>
              {nextSteps.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="min-w-48 flex-1 text-sm font-medium text-foreground">
            Note (optional, everyone on the order sees it)
            <input className={`${field} mt-1 block w-full`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="button" className={outlineButton} onClick={() => { setPicked([]); setMoveTo(''); }}>Clear</button>
          <button
            type="button"
            className={primaryButton}
            disabled={!moveTo || bulkBusy}
            onClick={() => (moveTo === 'cancelled' ? setConfirmCancel(true) : runBulk())}
          >
            {bulkBusy ? 'Updating…' : `Update ${picked.length} ${picked.length === 1 ? 'order' : 'orders'}`}
          </button>
        </div>
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="Cancel these orders?"
          description={`${picked.length} ${picked.length === 1 ? 'order' : 'orders'} will be cancelled and the stock put back.${role === 'seller' ? ' Only an admin can reopen a cancelled order.' : ''}`}
          confirmLabel="Cancel the orders"
          onConfirm={runBulk}
          onClose={() => setConfirmCancel(false)}
        />
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
