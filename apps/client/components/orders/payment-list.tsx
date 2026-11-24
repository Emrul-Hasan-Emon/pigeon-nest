'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { orderApi } from '@/lib/api/orders';
import { formatDateTime } from '@/lib/datetime';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { type GatewayOption, type PaymentListParams, type PaymentRow, type StaffRole } from '@/types/order';
import { base, field, money, outlineButton, PaymentStatusBadge, useApiError } from './ui';
import { LoadingBlock } from '@/components/ui/skeleton';

const PAGE_SIZE = 20;

const STATUS_CHIPS: { value: string; label: string }[] = [
  { value: '', label: 'All payments' },
  { value: 'due', label: 'Not paid yet' },
  { value: 'partially_paid', label: 'Part paid' },
  { value: 'paid', label: 'Paid' },
];

function Lbl({ text, hint, children }: { text: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-base font-semibold text-foreground">
      {text}
      <span className="mt-1 block font-normal">{children}</span>
      {hint && <span className="mt-0.5 block text-sm font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

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
  const [more, setMore] = useState(false);

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

  const moreCount = [filters.hasAttachments, filters.reversed, filters.minAmount, filters.maxAmount, filters.createdFrom, filters.createdTo, filters.paidFrom, filters.paidTo].filter(Boolean).length;
  const showMore = more || moreCount > 0;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-foreground">Payments</h1>
        <p className="text-base text-muted-foreground">
          {role === 'admin' ? 'Money received on every order.' : 'Money you have received for your orders.'} To mark an order as paid, open that order.
        </p>
      </div>

      <p className="mb-1 text-base font-semibold text-foreground">Show payments that are</p>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Payment status">
        {STATUS_CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={filters.status === c.value}
            onClick={() => setFilters((f) => ({ ...f, status: c.value }))}
            className={`rounded-full border px-4 py-1.5 text-base font-medium ${filters.status === c.value ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:border-foreground'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-4">
        <Lbl text="Order number"><input className={`${field} w-52`} placeholder="Example: PN261121-ABCD" value={filters.orderNumber} onChange={set('orderNumber')} /></Lbl>
        <Lbl text="Customer"><input className={`${field} w-64`} placeholder="Name, phone or email" value={filters.customerSearch} onChange={set('customerSearch')} /></Lbl>
        <Lbl text="Transaction ID"><input className={`${field} w-52`} placeholder="From the payment slip" value={filters.transactionId} onChange={set('transactionId')} /></Lbl>
        <Lbl text="Paid by">
          <select className={`${field} w-52`} value={filters.gatewayId} onChange={set('gatewayId')}>
            <option value="">Any way of paying</option>
            {gateways.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Lbl>
      </div>

      <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={showMore} className="mb-3 text-base font-semibold text-primary hover:underline">
        {showMore ? 'Hide extra filters' : `Show more filters${moreCount ? ` (${moreCount} in use)` : ''}`}
      </button>
      {showMore && (
        <div className="mb-4 grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Lbl text="Proof files">
            <select className={`${field} w-full`} value={filters.hasAttachments} onChange={set('hasAttachments')}>
              <option value="">With or without</option>
              <option value="true">Has proof files</option>
              <option value="false">No proof files</option>
            </select>
          </Lbl>
          <Lbl text="Taken back (reversed)?">
            <select className={`${field} w-full`} value={filters.reversed} onChange={set('reversed')}>
              <option value="">Show all</option>
              <option value="true">Only reversed ones</option>
              <option value="false">Hide reversed ones</option>
            </select>
          </Lbl>
          <Lbl text="Amount from (৳)"><input className={`${field} w-full`} inputMode="decimal" placeholder="Lowest" value={filters.minAmount} onChange={set('minAmount')} /></Lbl>
          <Lbl text="Amount up to (৳)"><input className={`${field} w-full`} inputMode="decimal" placeholder="Highest" value={filters.maxAmount} onChange={set('maxAmount')} /></Lbl>
          <Lbl text="Payment added from"><input type="date" className={`${field} w-full`} value={filters.createdFrom} onChange={set('createdFrom')} /></Lbl>
          <Lbl text="Payment added until"><input type="date" className={`${field} w-full`} value={filters.createdTo} onChange={set('createdTo')} /></Lbl>
          <Lbl text="Money received from"><input type="date" className={`${field} w-full`} value={filters.paidFrom} onChange={set('paidFrom')} /></Lbl>
          <Lbl text="Money received until"><input type="date" className={`${field} w-full`} value={filters.paidTo} onChange={set('paidTo')} /></Lbl>
        </div>
      )}
      {dirty && <button type="button" onClick={() => setFilters(EMPTY)} className={`${outlineButton} mb-4`}>Clear all filters</button>}

      {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                {['Payment no.', 'Order', 'Customer', ...(role === 'admin' ? ['Seller'] : []), 'Paid by', 'Amount (৳)', 'Status', 'Proof files', 'Money received on'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && <tr><td colSpan={role === 'admin' ? 11 : 10} className="px-4 py-6 text-center text-muted-foreground">No payments match. Try clearing the filters.</td></tr>}
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium text-foreground">#{p.id}</td>
                  <td className="px-4 py-3"><Link className="text-primary hover:underline" href={`${root}/orders/${p.orderId}`}>{p.orderNumber}</Link></td>
                  <td className="px-4 py-3 text-muted-foreground">{p.customer?.name}<span className="block text-xs">{p.customer?.phone}</span></td>
                  {role === 'admin' && <td className="px-4 py-3 text-muted-foreground">{p.seller?.name}</td>}
                  <td className="px-4 py-3 text-muted-foreground">{p.gateway.name}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{money(p.amount)}</td>
                  <td className="px-4 py-3">{p.reversal ? <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">Taken back</span> : <PaymentStatusBadge status={p.status} />}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.attachmentCount > 0 ? `${p.attachmentCount} ${p.attachmentCount === 1 ? 'file' : 'files'}` : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.paidAt ? formatDateTime(p.paidAt) : 'Not received yet'}</td>
                  <td className="px-4 py-3 text-right"><Link href={`${root}/payments/${p.id}`} className="font-semibold text-primary hover:underline">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && nextCursor !== null && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={loadMore} disabled={loadingMore} className={outlineButton}>{loadingMore ? 'Loading…' : 'Show more payments'}</button>
        </div>
      )}
    </div>
  );
}
