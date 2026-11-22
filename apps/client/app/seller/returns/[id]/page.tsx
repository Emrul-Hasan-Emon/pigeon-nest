'use client';

import { useParams } from 'next/navigation';
import { SellerShell } from '@/components/orders/ui';
import { ReturnDetailView } from '@/components/returns/return-detail';

export default function SellerReturnPage() {
  const params = useParams<{ id: string }>();
  return (
    <SellerShell active="returns">
      <ReturnDetailView role="seller" id={Number(params.id)} />
    </SellerShell>
  );
}
