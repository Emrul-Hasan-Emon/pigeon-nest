'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getWishlistInsights } from '@/lib/api/wishlist';
import type { SellerWishlistInsights } from '@/types/wishlist';

/** How often this seller's products are saved. Counts only: customers are never shown. */
export function SellerWishlistInsightsPanel() {
  const [data, setData] = useState<SellerWishlistInsights | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getWishlistInsights(5)
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  if (!data) return null;

  return (
    <section className="mb-6" aria-label="Wishlist demand">
      <h2 className="mb-1 text-base font-semibold text-foreground">Wishlist demand</h2>
      <p className="mb-3 text-sm text-muted-foreground">How many customers saved your products to buy later. You see the counts, not who.</p>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total saves</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{data.totalSaves}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Products saved</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {data.productsSaved}
            <span className="text-base font-normal text-muted-foreground"> of {data.products}</span>
          </p>
        </div>
      </div>
      {data.top.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No one has saved your products yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Most saved products</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saved by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.top.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/seller/products/${p.id}`} className="font-medium text-foreground hover:underline">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.wishlistCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-right text-xs">
        <Link href="/seller/products" className="text-primary hover:underline">See every product</Link>
      </p>
    </section>
  );
}
