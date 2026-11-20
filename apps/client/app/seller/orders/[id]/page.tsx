'use client';

import { useParams } from 'next/navigation';
import { OrderDetailView } from '@/components/orders/order-detail';
import { SellerShell } from '@/components/orders/ui';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  return <SellerShell active="orders"><OrderDetailView role="seller" id={Number(params.id)} /></SellerShell>;
}
