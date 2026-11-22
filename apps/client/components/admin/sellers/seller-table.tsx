'use client';

import Link from 'next/link';
import type { Seller, SellerActiveStatus } from '@/types/seller';
import { Avatar } from '../initials-avatar';

const STATUS_STYLES: Record<Seller['status'], string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
};

const ACTIVE_STYLES: Record<SellerActiveStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-muted text-muted-foreground',
  suspended: 'bg-red-100 text-red-700',
};

export function SellerTable({
  sellers,
  onChangeActive,
}: {
  sellers: Seller[];
  onChangeActive: (seller: Seller, activeStatus: SellerActiveStatus) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Avatar</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Commission</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Activity</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sellers.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                No sellers found.
              </td>
            </tr>
          )}
          {sellers.map((seller) => (
            <tr key={seller.id} className="border-t border-border">
              <td className="px-4 py-3">
                <Avatar name={seller.name} url={seller.avatarUrl} />
              </td>
              <td className="px-4 py-3 font-medium text-foreground">{seller.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{seller.email ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{seller.phone ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{seller.commission ? `${seller.commission.type === 'percentage' ? `${seller.commission.value}%` : `${seller.commission.value} / order`}${seller.commission.source === 'global' ? ' (global)' : ''}` : '—'}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[seller.status]}`}
                >
                  {seller.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <select
                  aria-label={`Activity of ${seller.name}`}
                  value={seller.activeStatus}
                  onChange={(event) =>
                    onChangeActive(seller, event.target.value as SellerActiveStatus)
                  }
                  className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium capitalize ${ACTIVE_STYLES[seller.activeStatus]}`}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/sellers/${seller.id}`}
                  className="font-medium text-primary hover:opacity-70"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
