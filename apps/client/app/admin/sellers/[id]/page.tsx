'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SellerForm } from '@/components/admin/sellers/seller-form';
import { SellerStatusHistoryPanel } from '@/components/admin/sellers/seller-status-history-panel';
import { getSeller } from '@/lib/api/sellers';
import { NotFoundApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import type { Seller } from '@/types/seller';

export default function EditSellerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSeller(Number(params.id))
      .then(setSeller)
      .catch((error) => {
        if (error instanceof NotFoundApiError) {
          showToast('That seller no longer exists.', 'error');
        } else {
          showToast('Failed to load seller.', 'error');
        }
        router.replace('/admin/sellers');
      })
      .finally(() => setLoading(false));
  }, [params.id, router, showToast]);

  if (loading) {
    return <p className="py-10 text-center text-muted-foreground">Loading…</p>;
  }
  if (!seller) return null;

  return (
    <>
      <SellerForm seller={seller} key={seller.id} />
      <SellerStatusHistoryPanel sellerId={seller.id} />
    </>
  );
}
