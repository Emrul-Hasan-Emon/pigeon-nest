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
  const [summary, setSummary] = useState<SellerProposalSummary | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const q = useDebouncedValue(search.trim());
  const b = useDebouncedValue(buyer.trim());

  const filters = useMemo(
    () => ({ ...filtersFor(tab, closedKind), search: q || undefined, buyerSearch: b || undefined }),
    [tab, closedKind, q, b],
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

  const dirty = Boolean(search || buyer);
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
            <p className="text-xs text-muted-foreground">{c.label}</p>
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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className={`${field} w-56`} placeholder="Search product" aria-label="Search product" value={search} onChange={(e) => setSearch(e.target.value)} />
        <input className={`${field} w-56`} placeholder="Search buyer" aria-label="Search buyer" value={buyer} onChange={(e) => setBuyer(e.target.value)} />
        {tab === 'closed' && (
          <select className={`${field} w-36`} aria-label="Closed kind" value={closedKind} onChange={(e) => setClosedKind(e.target.value)}>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        )}
        {dirty && <button type="button" className={outlineButton} onClick={() => { setSearch(''); setBuyer(''); }}>Clear</button>}
      </div>

      {list.error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{list.error}</p>}
      {list.loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
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
