'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { listMyProposals } from '@/lib/api/proposals';
import { ApiError } from '@/lib/api/http';
import { loginUrlFor } from '@/lib/auth/next-path';
import { formatDate } from '@/lib/datetime';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { money } from './product-card';
import { ProposalStateBadge } from './proposal-parts';
import type { Proposal, ProposalListParams } from '@/types/proposal';

const PAGE_SIZE = 20;
const field = 'h-9 rounded-full border border-st-line bg-white px-3 text-sm focus:border-st-ink focus:outline-none';

const TABS: { key: string; label: string; params: ProposalListParams }[] = [
  { key: 'all', label: 'All', params: {} },
  { key: 'turn', label: 'Your turn', params: { status: 'pending', awaiting: 'buyer' } },
  { key: 'wait', label: 'With the seller', params: { status: 'pending', awaiting: 'seller' } },
  { key: 'accepted', label: 'Accepted', params: { status: 'accepted' } },
  { key: 'used', label: 'Used', params: { status: 'used' } },
  { key: 'rejected', label: 'Rejected', params: { status: 'rejected' } },
  { key: 'cancelled', label: 'Cancelled', params: { status: 'cancelled' } },
];

function Row({ p }: { p: Proposal }) {
  return (
    <li>
      <Link
        href={`/proposals/${p.id}`}
        className="flex flex-col gap-3 rounded-xl border border-st-line bg-white p-3 transition-colors hover:border-st-ink sm:flex-row sm:items-center"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-st-dove">
            {(p.sku.imageUrl ?? p.product.thumbnailUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(p.sku.imageUrl ?? p.product.thumbnailUrl)!} alt="" loading="lazy" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="line-clamp-1 font-medium text-st-ink">{p.product.name}</p>
            <p className="line-clamp-1 text-xs text-st-slate">
              {p.sku.label ?? p.sku.sku} · {p.seller.name}
            </p>
            <p className="mt-0.5 text-sm text-st-ink">
              <span className="font-semibold">{money(p.price)}</span> × {p.quantity} = {money(p.total)}
              <span className="ml-2 text-xs text-st-slate">
                item was {money(p.skuPriceAtCreate)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
          <ProposalStateBadge proposal={p} />
          <span className="text-xs text-st-slate">{formatDate(p.updatedAt)}</span>
        </div>
      </Link>
    </li>
  );
}

export function MyProposals() {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const [items, setItems] = useState<Proposal[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const run = useRef(0);

  const params = useCallback((): ProposalListParams => {
    const t = TABS.find((x) => x.key === tab)!;
    return { ...t.params, search: debounced.trim() || undefined, limit: PAGE_SIZE };
  }, [tab, debounced]);

  useEffect(() => {
    const ticket = ++run.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    listMyProposals(params())
      .then((page) => {
        if (ticket !== run.current) return;
        setItems(page.results);
        setNextCursor(page.nextCursor);
        setError(null);
      })
      .catch((err) => {
        if (ticket !== run.current) return;
        if (err instanceof ApiError && err.status === 401) setSignedOut(true);
        else setError(err instanceof ApiError ? err.message : 'Could not load your offers.');
      })
      .finally(() => ticket === run.current && setLoading(false));
  }, [params]);

  async function loadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const page = await listMyProposals({ ...params(), cursor: nextCursor });
      setItems((cur) => [...cur, ...page.results.filter((r) => !cur.some((c) => c.id === r.id))]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load more.');
    } finally {
      setLoadingMore(false);
    }
  }

  if (signedOut) {
    return (
      <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold">Sign in to see your offers</p>
        <p className="mt-1 text-sm text-st-slate">The prices you offered sellers, and their answers, are kept here.</p>
        <Link href={loginUrlFor('/proposals')} className="mt-4 inline-flex rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Offer status" className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${tab === t.key ? 'bg-st-ink text-white' : 'border border-st-line bg-white text-st-ink hover:border-st-ink'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product"
          aria-label="Search your offers"
          maxLength={200}
          className={`${field} w-52`}
        />
      </div>

      {error && <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="py-12 text-center text-st-slate">Loading your offers…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold">{tab === 'all' && !search ? 'No offers yet' : 'No offers here'}</p>
          <p className="mt-1 text-sm text-st-slate">
            Where a seller takes offers, you will see a Make an offer box on the product page.
          </p>
          <Link href="/products" className="mt-4 inline-flex rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">
            Browse products
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <Row key={p.id} p={p} />
          ))}
        </ul>
      )}

      {!loading && nextCursor !== null && (
        <div className="mt-5 flex justify-center">
          <button type="button" onClick={loadMore} disabled={loadingMore} className="h-10 rounded-full border border-st-line bg-white px-6 text-sm font-medium text-st-ink hover:border-st-ink disabled:opacity-50">
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}
