'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ListFrame, td, th, usePagedList } from '@/components/commission/parts';
import { field, outlineButton } from '@/components/orders/ui';
import { Stars } from '@/components/reviews/stars';
import { listAdminReviews, listUserReviews } from '@/lib/api/reviews';
import { formatDateTime } from '@/lib/datetime';
import type { AdminReview } from '@/types/review';

const EMPTY = { search: '', rating: '', status: '', reported: '', from: '', to: '' };

export const reviewStatusBadge = (status: string) =>
  status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800';

/**
 * Every review with the customer, seller and product beside it.
 * With `userId` it is one customer's reviews (the user page). Hiding happens on the review's own page.
 */
export function AdminReviewList({ userId, sellerId, productId }: { userId?: number; sellerId?: number; productId?: number }) {
  const [f, setF] = useState(EMPTY);
  const fetcher =
    userId === undefined ? listAdminReviews : (p: Record<string, string | number | boolean | undefined>) => listUserReviews(userId, p);
  const list = usePagedList<AdminReview>('admin', fetcher, f, { sellerId, productId });
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((c) => ({ ...c, [k]: e.target.value }));
  const dirty = Object.values(f).some(Boolean);
  const wide = userId === undefined;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className={`${field} w-64`} placeholder="Customer, product or review text" aria-label="Search" value={f.search} onChange={set('search')} />
        <select className={`${field} w-32`} aria-label="Stars" value={f.rating} onChange={set('rating')}>
          <option value="">Any stars</option>
          {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s} {s === 1 ? 'star' : 'stars'}</option>)}
        </select>
        <select className={`${field} w-36`} aria-label="Status" value={f.status} onChange={set('status')}>
          <option value="">Any status</option>
          <option value="published">Published</option>
          <option value="hidden">Hidden</option>
        </select>
        <select className={`${field} w-40`} aria-label="Reports" value={f.reported} onChange={set('reported')}>
          <option value="">Reported or not</option>
          <option value="true">With open reports</option>
          <option value="false">No open reports</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">From <input type="date" className={field} value={f.from} onChange={set('from')} /></label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">To <input type="date" className={field} value={f.to} onChange={set('to')} /></label>
        {dirty && <button type="button" onClick={() => setF(EMPTY)} className={outlineButton}>Clear filters</button>}
      </div>
      <ListFrame {...list}>
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              <th className={th}>Posted</th>
              {wide && <th className={th}>Customer</th>}
              <th className={th}>Product</th>
              <th className={th}>Seller</th>
              <th className={th}>Review</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Helpful</th>
              <th className={`${th} text-right`}>Replies</th>
              <th className={`${th} text-right`}>Reports</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && <tr><td colSpan={wide ? 9 : 8} className="px-4 py-6 text-center text-muted-foreground">No reviews found.</td></tr>}
            {list.rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDateTime(r.createdAt)}</td>
                {wide && (
                  <td className={td}>
                    <Link href={`/admin/users/${r.user.id}`} className="font-medium text-primary hover:underline">{r.user.name}</Link>
                    <span className="block text-xs text-muted-foreground">{r.user.phone ?? r.user.email ?? ''}</span>
                  </td>
                )}
                <td className={td}>
                  <Link href={`/admin/catalog/products/${r.product.id}`} className="font-medium text-foreground hover:underline">{r.product.name}</Link>
                </td>
                <td className={td}><Link href={`/admin/sellers/${r.seller.id}`} className="text-primary hover:underline">{r.seller.name}</Link></td>
                <td className={`${td} max-w-xs`}>
                  <Link href={`/admin/reviews/${r.id}`} className="block hover:underline">
                    <Stars value={r.rating} size={14} />
                    {r.title && <span className="block font-medium text-foreground">{r.title}</span>}
                    {r.comment && <span className="line-clamp-2 text-muted-foreground">{r.comment}</span>}
                    {r.imageCount > 0 && <span className="text-xs text-muted-foreground">{r.imageCount} {r.imageCount === 1 ? 'photo' : 'photos'}</span>}
                  </Link>
                </td>
                <td className={td}><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${reviewStatusBadge(r.status)}`}>{r.status === 'published' ? 'Published' : 'Hidden'}</span></td>
                <td className={`${td} text-right tabular-nums`}>{r.helpfulCount}</td>
                <td className={`${td} text-right tabular-nums`}>{r.replyCount}</td>
                <td className={`${td} text-right tabular-nums ${r.reportCount > 0 ? 'font-semibold text-destructive' : ''}`}>{r.reportCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>
    </div>
  );
}
