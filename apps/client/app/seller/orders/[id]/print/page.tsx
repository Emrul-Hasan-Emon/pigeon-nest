'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { OrderPrintView } from '@/components/orders/order-print';
import { SellerShell } from '@/components/orders/ui';

function Print() {
  const params = useParams<{ id: string }>();
  const type = useSearchParams().get('type') === 'slip' ? 'slip' : 'invoice';
  return <OrderPrintView role="seller" id={Number(params.id)} initialType={type} />;
}

export default function SellerOrderPrintPage() {
  return (
    <SellerShell active="orders">
      <Suspense>
        <Print />
      </Suspense>
    </SellerShell>
  );
}
