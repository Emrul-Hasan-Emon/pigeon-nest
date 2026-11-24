'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProductEditForm } from '@/components/admin/catalog/products/product-edit-form';
import { ProductMediaManager } from '@/components/admin/catalog/products/product-media-manager';
import { getProduct } from '@/lib/api/products';
import { NotFoundApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import type { Product } from '@/types/product';
import { LoadingBlock } from '@/components/ui/skeleton';
import { useBreadcrumbTitle } from '@/components/ui/breadcrumbs';

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  useBreadcrumbTitle(product?.name);
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
    return <LoadingBlock />;
  }
  if (!product) return null;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Edit product</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/admin/catalog/products/${product.id}`}
            className="text-muted-foreground hover:text-foreground"
          >
            View details
          </Link>
          <Link href="/admin/catalog/products" className="text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
        </div>
      </div>

      <ProductEditForm product={product} key={`form-${product.id}`} />

      <ProductMediaManager product={product} key={`media-${product.id}`} />
    </div>
  );
}
