'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { OrderPrintView } from '@/components/orders/order-print';

function Print() {
  const params = useParams<{ id: string }>();
  const type = useSearchParams().get('type') === 'slip' ? 'slip' : 'invoice';
  return <OrderPrintView role="admin" id={Number(params.id)} initialType={type} />;
}

export default function AdminOrderPrintPage() {
  return (
    <Suspense>
      <Print />
    </Suspense>
  );
}
