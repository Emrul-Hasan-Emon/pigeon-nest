'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SellerFrame } from '@/components/seller/seller-frame';
import { ProductCreateForm } from '@/components/admin/catalog/products/product-create-form';
import { sellerProductPortal } from '@/lib/products/portal';
import { getSellerToken } from '@/lib/auth/seller-token';

export default function SellerNewProductPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getSellerToken()) router.replace('/seller/login');
  }, [router]);

  return (
    <SellerFrame active="products" width="max-w-5xl">
        <ProductCreateForm portal={sellerProductPortal} />
    </SellerFrame>
  );
}
