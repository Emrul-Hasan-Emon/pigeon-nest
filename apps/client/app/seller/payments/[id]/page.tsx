'use client';

import { useParams } from 'next/navigation';
import { PaymentDetailView } from '@/components/orders/payment-detail';
import { SellerShell } from '@/components/orders/ui';

export default function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  return <SellerShell active="payments"><PaymentDetailView role="seller" id={Number(params.id)} /></SellerShell>;
}
