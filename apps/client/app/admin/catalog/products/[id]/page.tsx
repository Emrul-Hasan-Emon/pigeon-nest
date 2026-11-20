'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProduct } from '@/lib/api/products';
import { NotFoundApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import { ProductStatusHistoryPanel } from '@/components/admin/catalog/products/product-status-history-panel';
import {
  isProductVisible,
  ProductActiveBadge,
  ProductStatusBadge,
} from '@/components/products/status-badges';
import type { Product } from '@/types/product';

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProduct(Number(params.id))
      .then(setProduct)
      .catch((error) => {
        if (error instanceof NotFoundApiError) {
          showToast('That product no longer exists.', 'error');
        } else {
          showToast('Failed to load product.', 'error');
        }
        router.replace('/admin/catalog/products');
      })
      .finally(() => setLoading(false));
  }, [params.id, router, showToast]);

  if (loading) {
    return <p className="py-10 text-center text-muted-foreground">Loading…</p>;
  }
  if (!product) return null;

  return (
    <div className="max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
          <p className="text-xs text-muted-foreground">
            {product.slug} · {product.seller?.name ?? 'No seller'} ·{' '}
            {product.category?.name ?? 'No category'}
            {product.collection ? ` · ${product.collection.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/admin/catalog/products/${product.id}/edit`}
            className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90"
          >
            Edit product
          </Link>
          <Link
            href="/admin/catalog/products"
            className="rounded-md border border-border px-4 py-2 text-foreground hover:bg-muted"
          >
            ← Back to list
          </Link>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <ProductStatusBadge status={product.status} />
        <ProductActiveBadge status={product.activeStatus} />
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isProductVisible(product) ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
          }`}
        >
          {isProductVisible(product) ? 'Visible on storefront' : 'Hidden from storefront'}
        </span>
        {product.isFeatured && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Featured
          </span>
        )}
        <span className="rounded-full bg-muted px-3 py-1 text-xs">
          {product.skus?.length ?? 0} SKUs
        </span>
      </div>

      {(product.rejectionReason || product.suspensionReason) && (
        <div className="mb-5 space-y-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {product.rejectionReason && (
            <p>
              <span className="font-medium">Rejected:</span> {product.rejectionReason}
            </p>
          )}
          {product.suspensionReason && (
            <p>
              <span className="font-medium">Suspended:</span> {product.suspensionReason}
            </p>
          )}
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          {product.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.thumbnailUrl}
              alt={product.name}
              className="aspect-square w-full rounded-xl border border-border object-cover"
            />
          )}
        </div>
        <div className="md:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-2 font-semibold text-foreground">Description</h2>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {product.description || 'No description.'}
            </p>
          </div>
        </div>
      </div>

      {product.seller && (
        <div className="mb-5 flex items-center gap-4 rounded-xl border border-border bg-card p-5">
          {product.seller.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.seller.avatarUrl}
              alt=""
              className="h-12 w-12 rounded-full border border-border object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
              —
            </span>
          )}
          <div className="text-sm">
            <h2 className="font-semibold text-foreground">Seller</h2>
            <p className="text-foreground">{product.seller.name}</p>
            <p className="text-xs text-muted-foreground">
              {[product.seller.email, product.seller.phone].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">
            {product.seller.status}
            {product.seller.activeStatus === 'active' ? '' : ` · ${product.seller.activeStatus}`}
          </span>
        </div>
      )}

      {(product.seoTitle || product.seoDescription) && (
        <div className="mb-5 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-2 font-semibold text-foreground">SEO</h2>
          <p className="text-sm">
            <span className="text-muted-foreground">Title: </span>
            {product.seoTitle || '—'}
          </p>
          <p className="mt-1 text-sm">
            <span className="text-muted-foreground">Description: </span>
            {product.seoDescription || '—'}
          </p>
        </div>
      )}

      {(product.media?.length ?? 0) > 0 && (
        <div className="mb-5 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold text-foreground">
            Media gallery ({product.media?.length})
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {product.media?.map((media) => (
              <div
                key={media.id}
                className="relative overflow-hidden rounded-lg border border-border"
              >
                {media.type === 'video' ? (
                  <video src={media.url} className="aspect-square w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.url} alt="" className="aspect-square w-full object-cover" />
                )}
                {media.isPrimary && (
                  <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Primary
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 font-semibold text-foreground">
          SKUs — variants ({product.skus?.length ?? 0})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1">Image</th>
                <th>SKU</th>
                <th>Variants</th>
                <th>Price</th>
                <th>Discount</th>
                <th>Qty</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {(product.skus ?? []).map((sku) => (
                <tr
                  key={sku.id}
                  className={`border-t border-border ${!sku.isActive ? 'opacity-50' : ''}`}
                >
                  <td className="py-2">
                    {sku.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sku.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                        —
                      </span>
                    )}
                  </td>
                  <td className="font-medium text-foreground">
                    {sku.sku ?? '—'}
                    {sku.isDefault ? ' ★' : ''}
                  </td>
                  <td>
                    {sku.variants
                      .map((v) => `${v.attribute.name}: ${v.attributeValue.name}`)
                      .join(', ') || '—'}
                  </td>
                  <td>৳{sku.price}</td>
                  <td>{sku.discountedPrice != null ? `৳${sku.discountedPrice}` : '—'}</td>
                  <td>{sku.quantity}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        sku.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {sku.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {(product.skus ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted-foreground">
                    No SKUs yet — add them from the edit page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductStatusHistoryPanel productId={product.id} />
    </div>
  );
}
