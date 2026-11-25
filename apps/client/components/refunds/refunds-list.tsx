'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LoadingBlock } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/http';
import { getRefund, listRefunds } from '@/lib/api/refunds';
import { formatDateTime } from '@/lib/datetime';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { REFUND_STATUS_WORD, type RefundPage, type RefundRecord, type RefundRow, type RefundStatus } from '@/types/refund';
import { AddRefundRecord, RefundActions } from './refund-actions';
import { RefundBadge, RefundRecords } from './refund-records';
import { formatMoney } from '@/lib/money';

const TABS: { value: RefundStatus | 'all'; label: string }[] = [
  { value: 'needs_to_refund', label: 'To refund' },
  { value: 'processing', label: 'Being refunded' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'all', label: 'All' },
];

function Row({ role, row, onDone }: { role: 'admin' | 'seller'; row: RefundRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<RefundRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        setDetail(await getRefund(role, row.id));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load the steps.');
      }
    }
  }

  return (
    <li className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={`/${role}/orders/${row.order.id}`} className="font-semibold text-primary hover:underline">{row.order.orderNumber}</Link>
        <RefundBadge status={row.status} />
        <span className="text-sm text-muted-foreground">{row.order.customerName} · {row.order.customerPhone}</span>
        {role === 'admin' && row.order.sellerName && <span className="text-sm text-muted-foreground">Seller: {row.order.sellerName}</span>}
        <span className="ml-auto text-sm text-muted-foreground">Cancelled order · {formatDateTime(row.createdAt)}</span>
      </div>
      <p className="mt-2 text-base text-foreground">
        To refund: <span className="font-semibold">{formatMoney(row.expectedAmount)}</span>
        {row.status === 'refunded' && row.amount !== null && <> · Sent back: <span className="font-semibold">{formatMoney(row.amount)}</span></>}
        {row.recordsOnOrder > 1 && <span className="ml-2 text-sm text-muted-foreground">({row.recordsOnOrder} records on this order)</span>}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <RefundActions role={role} id={row.id} status={row.status} expected={row.expectedAmount} onDone={onDone} />
        {role === 'admin' && <AddRefundRecord orderId={row.order.id} expected={row.order.amountPaid} onDone={onDone} />}
        <button type="button" onClick={toggle} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">{open ? 'Hide the steps' : 'See the steps'}</button>
      </div>
      {open && <div className="mt-3">{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : detail ? <RefundRecords records={[detail]} /> : <p className="text-sm text-muted-foreground">Loading…</p>}</div>}
    </li>
  );
}

/** The cancelled orders that had money paid, and where each refund stands. A seller sees their own; an admin sees all. */
export function RefundsList({ role }: { role: 'admin' | 'seller' }) {
  const [status, setStatus] = useState<RefundStatus | 'all'>('needs_to_refund');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RefundPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listRefunds(role, { status: status === 'all' ? undefined : status, search: q || undefined, page, pageSize: 10 })
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the refunds.'))
      .finally(() => setLoading(false));
  }, [role, status, q, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const pill = (on: boolean) => `rounded-full border px-4 py-2 font-medium ${on ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:bg-muted'}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show">
        {TABS.map((t) => <button key={t.value} type="button" aria-pressed={status === t.value} className={pill(status === t.value)} onClick={() => { setStatus(t.value); setPage(1); }}>{t.label}</button>)}
        <input className="ml-auto w-64 rounded-lg border border-input px-3 py-2" placeholder="Order number, name or phone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-destructive">{error}</p>}
      {loading && !data ? (
        <LoadingBlock />
      ) : data && data.results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground">{status === 'needs_to_refund' ? 'Nothing to refund right now.' : `No refunds here${status === 'all' ? '' : ` (${REFUND_STATUS_WORD[status].toLowerCase()})`}.`}</p>
      ) : (
        <ul className="space-y-3">{data?.results.map((r) => <Row key={r.id} role={role} row={r} onDone={load} />)}</ul>
      )}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-muted disabled:opacity-50">Previous</button>
          <span className="text-muted-foreground">Page {data.page} of {data.totalPages}</span>
          <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-muted disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
