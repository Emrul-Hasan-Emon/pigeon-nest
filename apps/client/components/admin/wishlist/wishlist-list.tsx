'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ListFrame, td, th, usePagedList } from '@/components/commission/parts';
import { field, money, outlineButton } from '@/components/orders/ui';
import { listAdminWishlist, listUserWishlist } from '@/lib/api/wishlist';
import { formatDateTime } from '@/lib/datetime';
import type { AdminWishlistRow } from '@/types/wishlist';

const EMPTY = { search: '', userSearch: '', sellerSearch: '' };

function Lbl({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {text}
      <span className="mt-1 block font-normal">{children}</span>
    </label>
  );
}

const AVAILABILITY: Record<string, { label: string; tone: string }> = {
  available: { label: 'Available', tone: 'bg-emerald-100 text-emerald-700' },
  out_of_stock: { label: 'Out of stock', tone: 'bg-amber-100 text-amber-800' },
  unavailable: { label: 'Not available', tone: 'bg-muted text-muted-foreground' },
  removed: { label: 'Removed', tone: 'bg-destructive/10 text-destructive' },
};

function PriceCell({ row }: { row: AdminWishlistRow }) {
  const change = row.priceChange;
  return (
    <>
      {row.product.price === null ? '—' : money(row.product.price)}
      <span className="block text-xs text-muted-foreground">saved at {money(row.priceWhenSaved)}</span>
      {change && change.direction !== 'same' && (
        <span className={`block text-xs font-medium ${change.direction === 'dropped' ? 'text-emerald-700' : 'text-amber-700'}`}>
          {change.direction === 'dropped' ? '↓' : '↑'} {money(change.amount)}
        </span>
      )}
    </>
  );
}

/**
 * Every saved product with the customer, the seller and the product beside it.
 * With `userId` it becomes one customer's wishlist (the user page). Read only.
 */
export function AdminWishlistList({ userId }: { userId?: number }) {
  const [f, setF] = useState(EMPTY);
  const fetcher = userId === undefined ? listAdminWishlist : (p: Record<string, string | number | boolean | undefined>) => listUserWishlist(userId, p);
  const list = usePagedList<AdminWishlistRow>('admin', fetcher, userId === undefined ? f : { search: f.search });
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF((c) => ({ ...c, [k]: e.target.value }));
  const dirty = Object.values(f).some(Boolean);
  const wide = userId === undefined;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Lbl text="Product name"><input className={`${field} w-56`} placeholder="Part of the name" value={f.search} onChange={set('search')} /></Lbl>
        {wide && <Lbl text="Customer (name, email or phone)"><input className={`${field} w-64`} placeholder="Who saved it" value={f.userSearch} onChange={set('userSearch')} /></Lbl>}
        {wide && <Lbl text="Seller (name, email or phone)"><input className={`${field} w-64`} placeholder="Whose product it is" value={f.sellerSearch} onChange={set('sellerSearch')} /></Lbl>}
        {dirty && <button type="button" onClick={() => setF(EMPTY)} className={outlineButton}>Clear all filters</button>}
      </div>
      <ListFrame {...list}>
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              <th className={th}>Saved</th>
              {wide && <th className={th}>Customer</th>}
              <th className={th}>Product</th>
              <th className={th}>Seller</th>
              <th className={th}>Price now</th>
              <th className={th}>State</th>
              <th className={`${th} text-right`} title="Customers who saved this product">Saved by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && <tr><td colSpan={wide ? 7 : 6} className="px-4 py-6 text-center text-muted-foreground">Nothing saved yet.</td></tr>}
            {list.rows.map((r) => {
              const a = AVAILABILITY[r.availability];
              return (
                <tr key={r.id} className="align-top">
                  <td className={`${td} text-muted-foreground`}>{formatDateTime(r.savedAt)}</td>
                  {wide && (
                    <td className={td}>
                      <Link href={`/admin/users/${r.user.id}`} className="font-medium text-primary hover:underline">{r.user.name}</Link>
                      <span className="block text-xs text-muted-foreground">{r.user.phone ?? r.user.email ?? ''}</span>
                    </td>
                  )}
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      {r.product.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.product.thumbnailUrl} alt="" className="h-10 w-10 rounded-md border border-border object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">—</span>
                      )}
                      <Link href={`/admin/catalog/products/${r.product.id}`} className="font-medium text-foreground hover:underline">{r.product.name ?? `Product #${r.product.id}`}</Link>
                    </div>
                  </td>
                  <td className={td}>
                    {r.seller ? <Link href={`/admin/sellers/${r.seller.id}`} className="text-primary hover:underline">{r.seller.name}</Link> : '—'}
                    {r.seller?.phone && <span className="block text-xs text-muted-foreground">{r.seller.phone}</span>}
                  </td>
                  <td className={td}><PriceCell row={r} /></td>
                  <td className={td}>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${a.tone}`} title={r.reason ?? ''}>{a.label}</span>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{r.product.wishlistCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ListFrame>
    </div>
  );
}
