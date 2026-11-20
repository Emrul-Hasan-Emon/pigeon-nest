'use client';

import Link from 'next/link';
import type { ProductStatusChangeAction, ProductStatusHistoryEntry } from '@/types/product';

export const PRODUCT_ACTION_LABELS: Record<ProductStatusChangeAction, string> = {
  baseline: 'Starting point',
  admin_created: 'Created by admin',
  seller_created: 'Created by seller',
  admin_updated: 'Changed by admin',
  seller_updated: 'Changed by seller',
};

const ACTION_STYLES: Record<ProductStatusChangeAction, string> = {
  baseline: 'bg-muted text-muted-foreground',
  admin_created: 'bg-emerald-100 text-emerald-700',
  seller_created: 'bg-emerald-100 text-emerald-700',
  admin_updated: 'bg-secondary text-secondary-foreground',
  seller_updated: 'bg-amber-100 text-amber-700',
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

export function ProductStatusHistoryTable({
  entries,
  showProduct,
}: {
  entries: ProductStatusHistoryEntry[];
  showProduct: boolean;
}) {
  const columns = showProduct ? 5 : 4;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">When</th>
            {showProduct && (
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
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
              {showProduct && (
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/catalog/products/${entry.sellerProductId}`}
                    className="font-medium text-primary hover:opacity-70"
                  >
                    {entry.product?.name ?? `Product #${entry.sellerProductId}`}
                  </Link>
                  <p className="text-xs text-muted-foreground">{entry.product?.seller?.name ?? ''}</p>
                </td>
              )}
              <td className="px-4 py-3">
                <span
                  className={`mb-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_STYLES[entry.action]}`}
                >
                  {PRODUCT_ACTION_LABELS[entry.action]}
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
                {entry.creatorType && (
                  <span className="block text-xs capitalize">{entry.creatorType}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
