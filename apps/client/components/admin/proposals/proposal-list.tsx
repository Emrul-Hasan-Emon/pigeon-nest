'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ListFrame, td, th, usePagedList } from '@/components/commission/parts';
import { field, money, outlineButton } from '@/components/orders/ui';
import { listAdminProposals } from '@/lib/api/proposals';
import { formatDateTime } from '@/lib/datetime';
import type { Proposal, ProposalListParams, ProposalStatus } from '@/types/proposal';

export const STATUS_LABEL: Record<ProposalStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  used: 'Used',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const STATUS_TONE: Record<ProposalStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-emerald-100 text-emerald-700',
  used: 'bg-sky-100 text-sky-700',
  rejected: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

export function ProposalStatusBadge({ proposal }: { proposal: Pick<Proposal, 'status' | 'awaitingParty'> }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[proposal.status]}`}>
      {STATUS_LABEL[proposal.status]}
      {proposal.status === 'pending' && proposal.awaitingParty && ` · waiting on ${proposal.awaitingParty}`}
    </span>
  );
}

const CHIPS: { value: '' | ProposalStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'used', label: 'Used' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const EMPTY = { status: '', awaiting: '', search: '', buyerSearch: '', sellerSearch: '', skuSearch: '', from: '', to: '', minPrice: '', maxPrice: '' };

// The list service types its params loosely; the API accepts the same keys.
function Lbl({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {text}
      <span className="mt-1 block font-normal">{children}</span>
    </label>
  );
}

const fetcher = (p: Record<string, string | number | boolean | undefined>) => listAdminProposals(p as ProposalListParams);

/** Every proposal, filterable. `userId` / `sellerId` arrive from the query string and can be dropped here. */
export function AdminProposalList({ userId, sellerId }: { userId?: number; sellerId?: number }) {
  const [f, setF] = useState(EMPTY);
  const [scope, setScope] = useState({ userId, sellerId });
  const list = usePagedList<Proposal>('admin', fetcher, f, scope);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((c) => ({ ...c, [k]: e.target.value }));
  const dirty = Object.values(f).some(Boolean);

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-foreground">Show offers that are</p>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Status">
        {CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={f.status === c.value}
            onClick={() => setF((x) => ({ ...x, status: c.value, awaiting: c.value === 'pending' ? x.awaiting : '' }))}
            className={`rounded-full border px-3 py-1 text-sm ${f.status === c.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Lbl text="Product name"><input className={`${field} w-52`} placeholder="Part of the name" value={f.search} onChange={set('search')} /></Lbl>
        <Lbl text="SKU code"><input className={`${field} w-40`} placeholder="Example: HOM-BB-M" value={f.skuSearch} onChange={set('skuSearch')} /></Lbl>
        <Lbl text="Buyer (name, email or phone)"><input className={`${field} w-60`} placeholder="Who made the offer" value={f.buyerSearch} onChange={set('buyerSearch')} /></Lbl>
        <Lbl text="Seller (name)"><input className={`${field} w-52`} placeholder="Whose product it is" value={f.sellerSearch} onChange={set('sellerSearch')} /></Lbl>
        <Lbl text="Whose answer is awaited">
          <select className={`${field} w-48`} value={f.awaiting} onChange={set('awaiting')} disabled={f.status !== '' && f.status !== 'pending'}>
            <option value="">Anyone</option>
            <option value="buyer">Waiting for the buyer</option>
            <option value="seller">Waiting for the seller</option>
          </select>
        </Lbl>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Lbl text="Offered from (date)"><input type="date" className={field} value={f.from} onChange={set('from')} /></Lbl>
        <Lbl text="Offered until (date)"><input type="date" className={field} value={f.to} onChange={set('to')} /></Lbl>
        <Lbl text="Offer at least (per item)"><input type="number" min={0} className={`${field} w-36`} placeholder="Lowest" value={f.minPrice} onChange={set('minPrice')} /></Lbl>
        <Lbl text="Offer at most (per item)"><input type="number" min={0} className={`${field} w-36`} placeholder="Highest" value={f.maxPrice} onChange={set('maxPrice')} /></Lbl>
        {scope.userId !== undefined && (
          <button type="button" onClick={() => setScope((s) => ({ ...s, userId: undefined }))} className="rounded-full bg-muted px-3 py-1 text-sm text-foreground hover:bg-border" title="Remove this filter">
            Buyer #{scope.userId} ✕
          </button>
        )}
        {scope.sellerId !== undefined && (
          <button type="button" onClick={() => setScope((s) => ({ ...s, sellerId: undefined }))} className="rounded-full bg-muted px-3 py-1 text-sm text-foreground hover:bg-border" title="Remove this filter">
            Seller #{scope.sellerId} ✕
          </button>
        )}
        {dirty && <button type="button" onClick={() => setF(EMPTY)} className={outlineButton}>Clear filters</button>}
      </div>
      <ListFrame {...list}>
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Buyer</th>
              <th className={th}>Seller</th>
              <th className={th}>Product</th>
              <th className={`${th} text-right`}>Qty</th>
              <th className={`${th} text-right`}>Per unit</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={`${th} text-right`}>SKU price</th>
              <th className={th}>Status</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">No proposals found.</td></tr>}
            {list.rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDateTime(r.createdAt)}</td>
                <td className={td}><Link href={`/admin/users/${r.buyer.id}`} className="font-medium text-primary hover:underline">{r.buyer.name}</Link></td>
                <td className={td}><Link href={`/admin/sellers/${r.seller.id}`} className="text-primary hover:underline">{r.seller.name}</Link></td>
                <td className={td}>
                  <Link href={`/admin/catalog/products/${r.product.id}`} className="font-medium text-foreground hover:underline">{r.product.name}</Link>
                  {(r.sku.label ?? r.sku.sku) && <span className="block text-xs text-muted-foreground">{r.sku.label ?? r.sku.sku}</span>}
                </td>
                <td className={`${td} text-right tabular-nums`}>{r.quantity}</td>
                <td className={`${td} text-right tabular-nums`}>{money(r.price)}</td>
                <td className={`${td} text-right font-medium tabular-nums`}>{money(r.total)}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {money(r.skuPriceAtCreate)}
                  <span className={`block text-xs ${r.skuPriceNow === r.skuPriceAtCreate ? 'text-muted-foreground' : 'text-amber-700'}`}>now {money(r.skuPriceNow)}</span>
                </td>
                <td className={td}><ProposalStatusBadge proposal={r} /></td>
                <td className={td}><Link href={`/admin/proposals/${r.id}`} className="whitespace-nowrap text-primary hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>
    </div>
  );
}

const compactFetcher = (userId: number) => (p: Record<string, string | number | boolean | undefined>) =>
  listAdminProposals({ ...(p as ProposalListParams), userId });

/** A few of one customer's latest proposals for the user page. */
export function AdminUserProposals({ userId }: { userId: number }) {
  const [fn] = useState(() => compactFetcher(userId));
  const list = usePagedList<Proposal>('admin', fn, {}, {}, 5);
  return (
    <div>
      <ListFrame {...list}>
        <table className="min-w-full divide-y divide-border text-sm">
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && <tr><td className="px-4 py-6 text-center text-muted-foreground">No price proposals.</td></tr>}
            {list.rows.map((r) => (
              <tr key={r.id}>
                <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDateTime(r.createdAt)}</td>
                <td className={td}>{r.product.name}{(r.sku.label ?? r.sku.sku) && <span className="text-muted-foreground"> · {r.sku.label ?? r.sku.sku}</span>}</td>
                <td className={`${td} whitespace-nowrap tabular-nums`}>{r.quantity} × {money(r.price)}</td>
                <td className={td}><ProposalStatusBadge proposal={r} /></td>
                <td className={td}><Link href={`/admin/proposals/${r.id}`} className="text-primary hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>
      <Link href={`/admin/proposals?userId=${userId}`} className="mt-2 inline-block text-sm text-primary hover:underline">View all</Link>
    </div>
  );
}
