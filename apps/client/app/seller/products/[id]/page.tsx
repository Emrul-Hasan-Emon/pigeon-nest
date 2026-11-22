'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { SellerFrame } from '@/components/seller/seller-frame';
import { ProductLockBanner } from '@/components/seller/product-lock-banner';
import { ProductEditForm } from '@/components/admin/catalog/products/product-edit-form';
import { ProductMediaManager } from '@/components/admin/catalog/products/product-media-manager';
import {
  isProductVisible,
  ProductActiveBadge,
  ProductStatusBadge,
} from '@/components/products/status-badges';
import { useToast } from '@/components/ui/toast';
import { sellerProductPortal } from '@/lib/products/portal';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import { clearSellerToken, getSellerToken } from '@/lib/auth/seller-token';
import type { Product } from '@/types/product';
import { LoadingBlock } from '@/components/ui/skeleton';

export default function SellerProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    sellerProductPortal
      .get(Number(params.id))
      .then(setProduct)
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          clearSellerToken();
          router.replace('/seller/login');
          return;
        }
        showToast(
          error instanceof NotFoundApiError ? 'That product no longer exists.' : 'Failed to load product.',
          'error',
        );
        router.replace('/seller/products');
      })
      .finally(() => setLoading(false));
  }, [params.id, router, showToast]);

  useEffect(() => {
    if (!getSellerToken()) {
      router.replace('/seller/login');
      return;
    }
    load();
  }, [load, router]);

  const locked = product ? product.status === 'rejected' || product.activeStatus === 'suspended' : false;

  return (
    <SellerFrame active="products" width="max-w-5xl">
        {loading || !product ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ProductStatusBadge status={product.status} />
                  <ProductActiveBadge status={product.activeStatus} />
                  <span className="text-xs text-muted-foreground">
                    {isProductVisible(product) ? 'Visible on the storefront' : 'Hidden from the storefront'}
                  </span>
                  <span className="text-xs text-muted-foreground" title="Customers who saved this product to their wishlist">
                    · Saved by {product.wishlistCount ?? 0} {product.wishlistCount === 1 ? 'customer' : 'customers'}
                  </span>
                </div>
              </div>
              <Link href="/seller/products" className="text-sm text-muted-foreground hover:text-foreground">
                ← Back
              </Link>
            </div>

            <ProductLockBanner product={product} />

            {/* A frozen product is read-only: a disabled fieldset disables every control inside. */}
            <fieldset disabled={locked} className="space-y-5 disabled:opacity-70">
              <ProductEditForm
                product={product}
                portal={sellerProductPortal}
                onSaved={setProduct}
                key={`form-${product.id}`}
              />
              <ProductMediaManager product={product} portal={sellerProductPortal} key={`media-${product.id}`} />
            </fieldset>
          </div>
        )}
    </SellerFrame>
  );
}
