'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { field, money, outlineButton } from '@/components/orders/ui';
import { OfferStatusBadge } from '@/components/seller/proposals/offer-parts';
import { SellerOfferModal } from '@/components/seller/proposals/seller-offer-modal';
import { getSellerProposalSummary, listSellerProposals } from '@/lib/api/proposals';
import { formatDateTime } from '@/lib/datetime';
import { useCursorList } from '@/lib/hooks/use-cursor-list';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import type { Proposal, ProposalListParams, SellerProposalSummary } from '@/types/proposal';
import type { Params } from '@/types/review';
import { LoadingBlock } from '@/components/ui/skeleton';

type Tab = 'needs' | 'waiting' | 'accepted' | 'used' | 'closed' | 'all';

const TABS: { key: Tab; label: string; count?: keyof SellerProposalSummary }[] = [
  { key: 'needs', label: 'Needs your answer', count: 'awaitingYou' },
  { key: 'waiting', label: 'Waiting for buyer' },
  { key: 'accepted', label: 'Accepted', count: 'accepted' },
  { key: 'used', label: 'Used', count: 'used' },
  { key: 'closed', label: 'Closed', count: 'closed' },
  { key: 'all', label: 'All' },
];

function filtersFor(tab: Tab, closedKind: string): Params {
  switch (tab) {
    case 'needs':
      return { status: 'pending', awaiting: 'seller' };
    case 'waiting':
      return { status: 'pending', awaiting: 'buyer' };
    case 'accepted':
      return { status: 'accepted' };
    case 'used':
      return { status: 'used' };
    // the API filters one status at a time, so closed is split in two
    case 'closed':
      return { status: closedKind };
    default:
      return {};
  }
}

const fetchPage = (p: Params) => listSellerProposals(p as ProposalListParams);

/** The seller's price offers from customers: summary, filter tabs, list and the detail modal. */
export function SellerOffers() {
  const [tab, setTab] = useState<Tab>('needs');
  const [closedKind, setClosedKind] = useState('rejected');
  const [search, setSearch] = useState('');
  const [buyer, setBuyer] = useState('');
  const [sku, setSku] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minP, setMinP] = useState('');
  const [maxP, setMaxP] = useState('');
  const [summary, setSummary] = useState<SellerProposalSummary | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const q = useDebouncedValue(search.trim());
  const b = useDebouncedValue(buyer.trim());
  const k = useDebouncedValue(sku.trim());
  const lo = useDebouncedValue(minP.trim());
  const hi = useDebouncedValue(maxP.trim());

  const filters = useMemo(
    () => ({
      ...filtersFor(tab, closedKind),
      search: q || undefined,
      buyerSearch: b || undefined,
      skuSearch: k || undefined,
      from: from || undefined,
      to: to || undefined,
      minPrice: lo || undefined,
      maxPrice: hi || undefined,
    }),
    [tab, closedKind, q, b, k, from, to, lo, hi],
  );
  const list = useCursorList<Proposal>(fetchPage, filters, 10);

  const loadSummary = useCallback(() => {
    getSellerProposalSummary().then(setSummary).catch(() => undefined);
    window.dispatchEvent(new Event('seller-offers-changed'));
  }, []);
  useEffect(() => {
     
    loadSummary();
  }, [loadSummary]);

  function changed() {
    list.reload();
    loadSummary();
  }

  const dirty = Boolean(search || buyer || sku || from || to || minP || maxP);
  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Open', value: summary?.pending },
          { label: 'Need your answer', value: summary?.awaitingYou, warn: true },
          { label: 'Accepted', value: summary?.accepted },
          { label: 'Used', value: summary?.used },
          { label: 'Closed', value: summary?.closed },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.warn && summary && summary.awaitingYou > 0 ? 'text-amber-700' : 'text-foreground'}`}>{c.value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.key ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
            {t.count && summary ? <span className="ml-1.5 text-xs text-muted-foreground">{summary[t.count]}</span> : null}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="block text-base text-foreground">
          Product name
          <input className={`${field} mt-1 block w-64`} placeholder="Type part of the name" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="block text-base text-foreground">
          Buyer name
          <input className={`${field} mt-1 block w-64`} placeholder="Type part of the name" value={buyer} onChange={(e) => setBuyer(e.target.value)} />
        </label>
        <label className="block text-base text-foreground">
          Option or SKU code
          <input className={`${field} mt-1 block w-48`} placeholder="Example: HOM-BB-M" value={sku} onChange={(e) => setSku(e.target.value)} />
        </label>
        {tab === 'closed' && (
          <label className="block text-base text-foreground">
            Show closed offers that were
            <select className={`${field} mt-1 block w-44`} value={closedKind} onChange={(e) => setClosedKind(e.target.value)}>
              <option value="rejected">Said no to</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        )}
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="block text-base text-foreground">
          Offered from (date)
          <input type="date" className={`${field} mt-1 block w-44`} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block text-base text-foreground">
          Offered until (date)
          <input type="date" className={`${field} mt-1 block w-44`} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="block text-base text-foreground">
          Buyer offers at least (৳)
          <input type="number" min={0} className={`${field} mt-1 block w-44`} placeholder="Lowest" value={minP} onChange={(e) => setMinP(e.target.value)} />
        </label>
        <label className="block text-base text-foreground">
          Buyer offers at most (৳)
          <input type="number" min={0} className={`${field} mt-1 block w-44`} placeholder="Highest" value={maxP} onChange={(e) => setMaxP(e.target.value)} />
        </label>
        {dirty && <button type="button" className={outlineButton} onClick={() => { setSearch(''); setBuyer(''); setSku(''); setFrom(''); setTo(''); setMinP(''); setMaxP(''); }}>Clear all filters</button>}
      </div>

      {list.error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{list.error}</p>}
      {list.loading ? (
        <LoadingBlock />
      ) : list.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {dirty ? 'No offers match this search.' : 'Nothing here. Offers appear when customers propose a price on a SKU that accepts proposals.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.rows.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpenId(p.id)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-card p-4 text-left shadow-sm hover:bg-muted/40"
              >
                <div className="min-w-48 flex-1">
                  <p className="font-medium text-foreground">{p.product.name}{p.sku.label ? <span className="font-normal text-muted-foreground"> · {p.sku.label}</span> : null}</p>
                  <p className="text-xs text-muted-foreground">{p.buyer.name} · {formatDateTime(p.updatedAt)}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-foreground">{money(p.price)} × {p.quantity}</p>
                  <p className="text-xs text-muted-foreground">total {money(p.total)}</p>
                </div>
                <OfferStatusBadge proposal={p} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!list.loading && list.hasMore && (
        <div className="mt-4 flex justify-center"><button type="button" onClick={list.more} disabled={list.moreLoading} className={outlineButton}>{list.moreLoading ? 'Loading…' : 'Load more'}</button></div>
      )}

      {openId !== null && <SellerOfferModal id={openId} onClose={() => setOpenId(null)} onChanged={changed} />}
    </div>
  );
}
