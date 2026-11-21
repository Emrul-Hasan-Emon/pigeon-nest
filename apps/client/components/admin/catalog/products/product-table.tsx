'use client';

import Link from 'next/link';
import { PRODUCT_ACTIVE_STYLES, PRODUCT_STATUS_STYLES } from '@/components/products/status-badges';
import type { Product, ProductActiveStatus, ProductStatus } from '@/types/product';

export function ProductTable({
  products,
  onChangeStatus,
  onChangeActive,
  onDelete,
}: {
  products: Product[];
  onChangeStatus: (product: Product, status: ProductStatus) => void;
  onChangeActive: (product: Product, activeStatus: ProductActiveStatus) => void;
  onDelete: (product: Product) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Image</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Seller</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Activity</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground" title="Customers who saved this product to their wishlist">Saved by</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {products.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                No products found.
              </td>
            </tr>
          )}
          {products.map((product) => (
            <tr key={product.id} className="border-t border-border">
              <td className="px-4 py-3">
                {product.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.thumbnailUrl}
                    alt=""
                    className="h-10 w-10 rounded-md border border-border object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                    —
                  </span>
                )}
              </td>
              <td className="px-4 py-3 font-medium text-foreground">{product.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{product.seller?.name ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{product.category?.name ?? '—'}</td>
              <td className="px-4 py-3">
                <select
                  aria-label={`Status of ${product.name}`}
                  value={product.status}
                  onChange={(event) => onChangeStatus(product, event.target.value as ProductStatus)}
                  className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium capitalize ${PRODUCT_STATUS_STYLES[product.status]}`}
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </td>
              <td className="px-4 py-3">
                <select
                  aria-label={`Activity of ${product.name}`}
                  value={product.activeStatus}
                  onChange={(event) =>
                    onChangeActive(product, event.target.value as ProductActiveStatus)
                  }
                  className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium capitalize ${PRODUCT_ACTIVE_STYLES[product.activeStatus]}`}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{product.wishlistCount ?? 0}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-3">
                  <Link
                    href={`/admin/catalog/products/${product.id}`}
                    className="font-medium text-foreground hover:opacity-70"
                  >
                    View
                  </Link>
                  <Link
                    href={`/admin/catalog/products/${product.id}/edit`}
                    className="font-medium text-primary hover:opacity-70"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDelete(product)}
                    className="font-medium text-destructive hover:opacity-70"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
