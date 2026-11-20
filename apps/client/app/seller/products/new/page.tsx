'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SellerSidebar } from '@/components/seller/seller-sidebar';
import { ProductCreateForm } from '@/components/admin/catalog/products/product-create-form';
import { sellerProductPortal } from '@/lib/products/portal';
import { getSellerToken } from '@/lib/auth/seller-token';

export default function SellerNewProductPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getSellerToken()) router.replace('/seller/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-background pl-56">
      <SellerSidebar active="products" />
      <main className="mx-auto max-w-5xl px-6 py-6">
        <ProductCreateForm portal={sellerProductPortal} />
      </main>
    </div>
  );
}
