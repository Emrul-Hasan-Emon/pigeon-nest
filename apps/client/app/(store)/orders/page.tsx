'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Breadcrumb, Container } from '@/components/store/page-parts';
import { Pagination } from '@/components/store/pagination';
import { money, OrderBadge, ORDER_TEXT, PaymentBadge } from '@/components/store/order-parts';
import { listMyOrders, type MyOrderPage } from '@/lib/api/customer-orders';
import { formatDateTime } from '@/lib/datetime';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { ORDER_STATUSES, type OrderStatus } from '@/types/order';

const select = 'rounded-full border border-st-line bg-white px-3 py-1.5 text-sm text-st-ink focus:border-st-teal focus:outline-none';

export default function MyOrdersPage() {
  const [status, setStatus] = useState<'' | OrderStatus>('');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MyOrderPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = 'Your orders | Pigeon Nest';
  }, []);

  useEffect(() => {
    let cancelled = false;
    listMyOrders({ page, pageSize: 10, status: status || undefined, search: debounced.trim() || undefined })
      .then((r) => {
        if (cancelled) return;
        setData(r);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [page, status, debounced, attempt]);

  const filtered = !!status || !!debounced.trim();
  return (
    <Container className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Your orders' }]} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-st-ink sm:text-3xl">Your orders</h1>
          <p className="text-sm text-st-slate">One order per seller. Open one to see where it is.</p>
        </div>
        <Link href="/orders/track" className="text-sm text-st-slate underline-offset-2 hover:text-st-ink hover:underline">Track an order with its number</Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input type="search" aria-label="Search by order number" placeholder="Order number" className={`${select} w-48`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select aria-label="Status" className={select} value={status} onChange={(e) => { setStatus(e.target.value as '' | OrderStatus); setPage(1); }}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_TEXT[s]}</option>)}
        </select>
      </div>

      {failed ? (
        <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold">We couldn’t load your orders</p>
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="mt-4 rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Try again</button>
        </div>
      ) : data === null ? (
        <div className="store-skeleton space-y-3" aria-busy="true"><div className="h-24 rounded-xl bg-st-line" /><div className="h-24 rounded-xl bg-st-line" /></div>
      ) : data.results.length === 0 ? (
        <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold">{filtered ? 'No orders match' : 'No orders yet'}</p>
          <p className="mt-1 text-sm text-st-slate">{filtered ? 'Try another status or order number.' : 'When you place an order it will show up here. Placed one as a guest on another device? Track it with its number.'}</p>
          {!filtered && <Link href="/products" className="mt-4 inline-flex rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Browse products</Link>}
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {data.results.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="block rounded-xl border border-st-line bg-white p-4 transition-colors hover:border-st-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display font-semibold text-st-ink">{o.orderNumber}</p>
                    <div className="flex gap-2"><OrderBadge status={o.status} /><PaymentBadge status={o.paymentStatus} /></div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {o.previewItems.map((p, i) => (
                        <span key={i} className="h-10 w-10 overflow-hidden rounded-lg border-2 border-white bg-st-ink-2">
                          {p.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                          )}
                        </span>
                      ))}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm text-st-slate">{o.seller.name} · {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}</p>
                    <p className="text-sm font-semibold text-st-ink">{money(o.payable)}</p>
                  </div>
                  <p className="mt-1 text-xs text-st-slate">Placed {formatDateTime(o.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}
    </Container>
  );
}
