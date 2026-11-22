'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getWishlistInsights } from '@/lib/api/wishlist';
import type { SellerWishlistInsights } from '@/types/wishlist';
import { LoadingBlock } from '@/components/ui/skeleton';

/** How often this seller's products are saved. Counts only: customers are never shown. */
export function SellerWishlistInsightsPanel({ limit = 5, title = 'Wishlist demand' }: { limit?: number; title?: string }) {
  const [data, setData] = useState<SellerWishlistInsights | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getWishlistInsights(limit)
      .then(setData)
      .catch(() => setFailed(true));
  }, [limit]);

  if (failed) return <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">Could not load wishlist numbers.</p>;
  if (!data) return <LoadingBlock />;
  return <WishlistInsightsView data={data} title={title} />;
}

/** The wishlist numbers and table, for data already in hand. The dashboard passes the figures it fetched with everything else. */
export function WishlistInsightsView({ data, title = 'Wishlist demand' }: { data: SellerWishlistInsights; title?: string }) {
  return (
    <section className="mb-6" aria-label="Wishlist demand">
      <h2 className="mb-1 font-semibold text-foreground">{title}</h2>
      <p className="mb-3 text-sm text-muted-foreground">How many customers saved your products to buy later. You see the counts, not who.</p>
      <div className="mb-4 overflow-hidden rounded-xl border border-border bg-border shadow-sm">
        <div className="grid grid-cols-2 gap-px">
          <div className="bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Total saves</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground">{data.totalSaves}</p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Products saved</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground">
              {data.productsSaved}
              <span className="text-base font-normal text-muted-foreground"> of {data.products}</span>
            </p>
          </div>
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
