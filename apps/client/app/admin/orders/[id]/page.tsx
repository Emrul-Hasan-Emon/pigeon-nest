'use client';

import { useParams } from 'next/navigation';
import { OrderDetailView } from '@/components/orders/order-detail';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  return <OrderDetailView role="admin" id={Number(params.id)} />;
}
