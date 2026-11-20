'use client';

import Link from 'next/link';
import type { SellerStatusChangeAction, SellerStatusHistoryEntry } from '@/types/seller';

export const ACTION_LABELS: Record<SellerStatusChangeAction, string> = {
  baseline: 'Starting point',
  registered: 'Registered',
  admin_created: 'Created by admin',
  approved: 'Approved',
  rejected: 'Rejected',
  resubmitted: 'Resubmitted',
  admin_updated: 'Changed by admin',
};

const ACTION_STYLES: Record<SellerStatusChangeAction, string> = {
  baseline: 'bg-muted text-muted-foreground',
  registered: 'bg-amber-100 text-amber-700',
  admin_created: 'bg-emerald-100 text-emerald-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  resubmitted: 'bg-amber-100 text-amber-700',
  admin_updated: 'bg-secondary text-secondary-foreground',
};

function Transition({ label, from, to }: { label: string; from: string | null; to: string }) {
  const changed = from !== to;
  return (
    <p className={changed ? 'text-foreground' : 'text-muted-foreground'}>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}: </span>
      {changed ? (
        <>
          {from && <span className="capitalize">{from}</span>}
          {from && ' → '}
          <span className="font-medium capitalize">{to}</span>
        </>
      ) : (
        <span className="capitalize">{to} (unchanged)</span>
      )}
    </p>
  );
}

export function StatusHistoryTable({
  entries,
  showSeller,
}: {
  entries: SellerStatusHistoryEntry[];
  showSeller: boolean;
}) {
  const columns = showSeller ? 5 : 4;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">When</th>
            {showSeller && (
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Seller</th>
            )}
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Change</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Note</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.length === 0 && (
            <tr>
              <td colSpan={columns} className="px-4 py-6 text-center text-muted-foreground">
                No history found.
              </td>
            </tr>
          )}
          {entries.map((entry) => (
            <tr key={entry.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString()}
              </td>
              {showSeller && (
                <td className="px-4 py-3">
                  {entry.seller ? (
                    <Link
                      href={`/admin/sellers/${entry.seller.id}`}
                      className="font-medium text-primary hover:opacity-70"
                    >
                      {entry.seller.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Seller #{entry.sellerId}</span>
                  )}
                  <p className="text-xs text-muted-foreground">{entry.seller?.phone ?? ''}</p>
                </td>
              )}
              <td className="px-4 py-3">
                <span
                  className={`mb-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_STYLES[entry.action]}`}
                >
                  {ACTION_LABELS[entry.action]}
                </span>
                <Transition label="Status" from={entry.fromStatus} to={entry.toStatus} />
                <Transition
                  label="Activity"
                  from={entry.fromActiveStatus}
                  to={entry.toActiveStatus}
                />
              </td>
              <td className="max-w-xs px-4 py-3 text-foreground">
                {entry.reason ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                <span className="text-foreground">{entry.creatorName ?? '—'}</span>
                {entry.creatorType && <span className="block text-xs capitalize">{entry.creatorType}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
