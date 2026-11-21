'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { field } from '@/components/orders/ui';
import { td, th } from '@/components/commission/parts';
import { listMostSaved } from '@/lib/api/wishlist';
import { ApiError } from '@/lib/api/http';
import type { MostSavedProduct } from '@/types/wishlist';

/** Products saved by the most customers, across all sellers. */
export function MostSavedReport() {
  const [sellerId, setSellerId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [limit, setLimit] = useState('20');
  const [rows, setRows] = useState<MostSavedProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = (v: string) => (/^[1-9]\d*$/.test(v.trim()) ? Number(v) : undefined);
    const timer = setTimeout(() => {
      listMostSaved({ sellerId: id(sellerId), categoryId: id(categoryId), limit: Math.min(100, Math.max(1, Number(limit) || 20)) })
        .then((r) => {
          setRows(r);
          setError(null);
        })
        .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load.'));
    }, 300);
    return () => clearTimeout(timer);
  }, [sellerId, categoryId, limit]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className={`${field} w-32`} inputMode="numeric" placeholder="Seller ID" aria-label="Seller ID" value={sellerId} onChange={(e) => setSellerId(e.target.value)} />
        <input className={`${field} w-32`} inputMode="numeric" placeholder="Category ID" aria-label="Category ID" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
        <select className={field} value={limit} onChange={(e) => setLimit(e.target.value)} aria-label="How many">
          <option value="10">Top 10</option>
          <option value="20">Top 20</option>
          <option value="50">Top 50</option>
          <option value="100">Top 100</option>
        </select>
      </div>
      {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {rows === null ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                <th className={th}>Product</th>
                <th className={th}>Seller</th>
                <th className={th}>Category</th>
                <th className={`${th} text-right`}>Saved by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No saved products match.</td></tr>}
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className={td}>
                    <Link href={`/admin/catalog/products/${p.id}`} className="font-medium text-foreground hover:underline">{p.name}</Link>
                  </td>
                  <td className={td}><Link href={`/admin/sellers/${p.seller.id}`} className="text-primary hover:underline">{p.seller.name}</Link></td>
                  <td className={`${td} text-muted-foreground`}>{p.category?.name ?? '—'}</td>
                  <td className={`${td} text-right font-medium tabular-nums`}>{p.wishlistCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
