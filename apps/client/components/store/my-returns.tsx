'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pagination } from './pagination';
import { money, ReturnStateBadge, RETURN_TEXT } from './return-parts';
import { listMyReturns } from '@/lib/api/returns';
import { ApiError } from '@/lib/api/http';
import { loginUrlFor } from '@/lib/auth/next-path';
import { formatDate } from '@/lib/datetime';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { RETURN_STATUSES, type ReturnPage, type ReturnStatus } from '@/types/returns';

const select = 'rounded-full border border-st-line bg-white px-3 py-1.5 text-sm text-st-ink focus:border-st-teal focus:outline-none';

export function MyReturns() {
  const [status, setStatus] = useState<'' | ReturnStatus>('');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReturnPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listMyReturns({ page, pageSize: 10, status: status || undefined, search: debounced.trim() || undefined })
      .then((r) => {
        if (cancelled) return;
        setData(r);
        setFailed(false);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) setSignedOut(true);
        else setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [page, status, debounced, attempt]);

  if (signedOut) {
    return (
      <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold">Sign in to see your returns</p>
        <Link href={loginUrlFor('/returns')} className="mt-4 inline-flex rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Sign in</Link>
      </div>
    );
  }
  const filtered = !!status || !!debounced.trim();
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input type="search" aria-label="Search by return or order number" placeholder="Return or order number" className={`${select} w-56`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select aria-label="Status" className={select} value={status} onChange={(e) => { setStatus(e.target.value as '' | ReturnStatus); setPage(1); }}>
          <option value="">All statuses</option>
          {RETURN_STATUSES.map((s) => <option key={s} value={s}>{RETURN_TEXT[s]}</option>)}
        </select>
      </div>
      {failed ? (
        <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold">We couldn’t load your returns</p>
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="mt-4 rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Try again</button>
        </div>
      ) : data === null ? (
        <div className="store-skeleton space-y-3" aria-busy="true"><div className="h-20 rounded-xl bg-st-line" /><div className="h-20 rounded-xl bg-st-line" /></div>
      ) : data.results.length === 0 ? (
        <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold">{filtered ? 'No returns match' : 'No returns yet'}</p>
          <p className="mt-1 text-sm text-st-slate">{filtered ? 'Try another status or number.' : 'Open a delivered order to ask for a return.'}</p>
          {!filtered && <Link href="/orders" className="mt-4 inline-flex rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Your orders</Link>}
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {data.results.map((r) => (
              <li key={r.id}>
                <Link href={`/returns/${r.id}`} className="block rounded-xl border border-st-line bg-white p-4 transition-colors hover:border-st-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-st-ink">{r.returnNumber} <span className="font-normal text-st-slate">· order {r.order.orderNumber}</span></p>
                    <ReturnStateBadge status={r.status} />
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-st-slate">{r.scope === 'full_order' ? 'Whole order' : r.previewItems.map((p) => p.productName).join(', ') + (r.itemCount > 3 ? '…' : '')}</p>
                  <p className="mt-1 text-sm text-st-ink"><span className="font-semibold">{money(r.refundAmount)}</span> refund <span className="text-xs text-st-slate">· {formatDate(r.createdAt)} · {r.seller.name}</span></p>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
